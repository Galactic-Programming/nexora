import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Destination, MediaOwnerType, Prisma } from '@prisma/client';
import { slugify } from '../../common/slugify';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { ListDestinationsQueryDto } from './dto/list-destinations-query.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';

/**
 * Pagination envelope returned by `list` methods.
 *
 * The `TransformInterceptor` recognises this shape and hoists `meta` to the
 * response envelope's top level, so consumers see
 * `{ data: items, error: null, meta }`.
 */
export interface PaginatedDestinations {
  items: Destination[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Owns CRUD + search for the `Destination` table.
 *
 * Public methods (`findPublic*`) hide soft-deleted / unpublished rows
 * (`is_active = false`). Admin methods (`findAll`, `findById`) honour the
 * `isActive` filter so admins can see drafts.
 *
 * Slug uniqueness is enforced at the DB level (`@unique` in Prisma); we
 * translate the `P2002` error into a clean `ConflictException` here so the
 * controller layer doesn't have to peek at Prisma error codes.
 */
@Injectable()
export class DestinationsService {
  private readonly logger = new Logger(DestinationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────
  // Public read paths
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Public list endpoint — only returns active destinations.
   *
   * Uses the same query DTO as the admin variant but force-overrides
   * `isActive: true` so end users never see drafts.
   *
   * @param query  Validated query params (page, pageSize, search, sort).
   * @returns      Paginated active destinations.
   */
  findPublicList(
    query: ListDestinationsQueryDto,
  ): Promise<PaginatedDestinations> {
    return this.list({ ...query, isActive: true });
  }

  /**
   * Public detail endpoint — fetch by slug, only if active.
   *
   * @param slug  URL slug (kebab-case).
   * @returns     The matching destination row.
   * @throws NotFoundException — slug doesn't exist OR is inactive.
   */
  async findPublicBySlug(slug: string): Promise<Destination> {
    const destination = await this.prisma.destination.findFirst({
      where: { slug, isActive: true },
    });
    if (!destination) {
      throw new NotFoundException({
        code: 'DESTINATION_NOT_FOUND',
        message: `Destination "${slug}" not found`,
      });
    }
    return this.media.attachToOwner(MediaOwnerType.DESTINATION, destination);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Admin paths (mutations + unfiltered reads)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Admin list endpoint — honours every query filter, including
   * `isActive` (so admins can see drafts).
   *
   * @param query  Validated query params.
   * @returns      Paginated destinations.
   */
  findAll(query: ListDestinationsQueryDto): Promise<PaginatedDestinations> {
    return this.list(query);
  }

  /**
   * Admin detail by slug — does NOT filter on `isActive`.
   *
   * @param slug  URL slug.
   * @throws NotFoundException — slug doesn't exist (regardless of active flag).
   */
  async findBySlug(slug: string): Promise<Destination> {
    const destination = await this.prisma.destination.findUnique({
      where: { slug },
    });
    if (!destination) {
      throw new NotFoundException({
        code: 'DESTINATION_NOT_FOUND',
        message: `Destination "${slug}" not found`,
      });
    }
    return this.media.attachToOwner(MediaOwnerType.DESTINATION, destination);
  }

  /**
   * Creates a new destination.
   *
   * Slug uniqueness: enforced by the DB. Prisma raises `P2002` on
   * duplicate; we translate to `409 Conflict` with a stable `code` so
   * frontends can show "this slug is taken" without parsing the message.
   *
   * @param body  Validated DTO.
   * @returns     The created row.
   * @throws ConflictException — slug already exists.
   */
  async create(body: CreateDestinationDto): Promise<Destination> {
    // Normalize ANY admin input ("Hội An 2024" → hoi-an-2024); omitted slug
    // falls back to nameEn. Symbol-only input → 400 INVALID_SLUG.
    const slug = this.normalizeSlug(body.slug, body.nameEn);
    try {
      const destination = await this.prisma.$transaction(async (tx) => {
        const created = await tx.destination.create({
          data: this.mapCreatePayload(body, slug),
        });
        if (body.media) {
          await this.media.syncAssets(
            tx,
            MediaOwnerType.DESTINATION,
            created.id,
            body.media,
          );
        }
        return created;
      });
      this.logger.log(
        `Created destination ${destination.slug} (id=${destination.id})`,
      );
      return this.media.attachToOwner(MediaOwnerType.DESTINATION, destination);
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictException({
          code: 'DESTINATION_SLUG_EXISTS',
          message: `Slug "${body.slug}" is already in use`,
        });
      }
      throw err;
    }
  }

  /**
   * Partial update.
   *
   * Empty body is a no-op (`update({})` returns the current row unchanged
   * — Prisma still hits the DB but the result is correct).
   *
   * @param slug  Current slug (URL parameter).
   * @param body  Validated partial DTO.
   * @returns     The updated row.
   * @throws NotFoundException — slug doesn't exist.
   * @throws ConflictException — body changes `slug` to one already in use.
   */
  async update(slug: string, body: UpdateDestinationDto): Promise<Destination> {
    // Surface a clean 404 BEFORE attempting the update, otherwise Prisma
    // would throw P2025 which we'd have to translate identically anyway.
    await this.findBySlug(slug);
    const { media, ...fields } = body;
    // A slug sent in the PATCH body goes through the same normalization as
    // create — admins can rename with any input format.
    if (fields.slug !== undefined) {
      fields.slug = this.normalizeSlug(fields.slug, fields.nameEn);
    }
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.destination.update({
          where: { slug },
          data: fields,
        });
        if (media) {
          await this.media.syncAssets(
            tx,
            MediaOwnerType.DESTINATION,
            row.id,
            media,
          );
        }
        return row;
      });
      return this.media.attachToOwner(MediaOwnerType.DESTINATION, updated);
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictException({
          code: 'DESTINATION_SLUG_EXISTS',
          message: `Slug "${body.slug}" is already in use`,
        });
      }
      throw err;
    }
  }

  /**
   * Hard delete.
   *
   * We deliberately use a hard delete (not soft) for the v1 scope —
   * `is_active = false` already provides a "hide without deleting"
   * affordance. If the row has dependent Tours, Prisma's referential
   * action `onDelete: Restrict` raises `P2003`; we translate to 409.
   *
   * @param slug  URL slug.
   * @returns     The deleted row (echo so admins can confirm what was removed).
   * @throws NotFoundException — slug doesn't exist.
   * @throws ConflictException — destination still has tours.
   */
  async remove(slug: string): Promise<Destination> {
    const existing = await this.findBySlug(slug);
    try {
      const deleted = await this.prisma.$transaction(async (tx) => {
        await this.media.deleteForOwner(
          tx,
          MediaOwnerType.DESTINATION,
          existing.id,
        );
        return tx.destination.delete({ where: { slug } });
      });
      this.logger.log(`Deleted destination ${deleted.slug} (id=${deleted.id})`);
      return deleted;
    } catch (err) {
      if (this.isForeignKeyError(err)) {
        throw new ConflictException({
          code: 'DESTINATION_HAS_TOURS',
          message:
            'Cannot delete destination while tours reference it. ' +
            'Delete or reassign the tours first.',
        });
      }
      throw err;
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Shared list implementation used by both public and admin endpoints.
   *
   * Builds a `where` clause from the query DTO, runs `count` + `findMany`
   * in a single Prisma transaction so the totals match the page contents
   * exactly (no skew if rows are inserted between the two queries).
   *
   * @param query  Already-validated query params (the public path
   *               injects `isActive: true` before delegating here).
   */
  private async list(
    query: ListDestinationsQueryDto,
  ): Promise<PaginatedDestinations> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';
    const search = query.search?.trim();

    const where: Prisma.DestinationWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(search
        ? {
            OR: [
              { nameEn: { contains: search, mode: 'insensitive' } },
              { nameVi: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // Read-only list+count: use Promise.all (NOT $transaction) — the Supabase
    // transaction-mode pooler (connection_limit=1) can't start a batch transaction
    // under concurrency; pagination needs no cross-query snapshot consistency.
    const [items, total] = await Promise.all([
      this.prisma.destination.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.destination.count({ where }),
    ]);

    const itemsWithMedia = await this.media.attachToOwners(
      MediaOwnerType.DESTINATION,
      items,
    );

    return {
      items: itemsWithMedia,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  /**
   * Normalises the create payload — applies the `isActive` default here
   * (rather than in the DTO) so the DB schema's default never silently
   * disagrees with the API contract.
   */
  /**
   * Normalizes (or generates, when `provided` is absent/blank) the slug.
   * Cap 80 chars mirrors the DB `VarChar(80)`; a trailing hyphen left by the
   * cut is trimmed so the result still matches the canonical kebab format.
   *
   * @throws BadRequestException — `INVALID_SLUG` when nothing usable remains.
   */
  private normalizeSlug(
    provided: string | undefined,
    fallback?: string,
  ): string {
    const source = provided?.trim() ? provided : (fallback ?? '');
    const normalized = slugify(source).slice(0, 80).replace(/-+$/, '');
    if (!normalized) {
      throw new BadRequestException({
        code: 'INVALID_SLUG',
        message:
          'Slug (or nameEn fallback) contains no usable characters after normalization',
      });
    }
    return normalized;
  }

  private mapCreatePayload(
    body: CreateDestinationDto,
    slug: string,
  ): Prisma.DestinationCreateInput {
    return {
      slug,
      nameEn: body.nameEn,
      nameVi: body.nameVi,
      country: body.country ?? 'Vietnam',
      region: body.region,
      descriptionEn: body.descriptionEn,
      descriptionVi: body.descriptionVi,
      isActive: body.isActive ?? true,
    };
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    );
  }

  private isForeignKeyError(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2003'
    );
  }
}
