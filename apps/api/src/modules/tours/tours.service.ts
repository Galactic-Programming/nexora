import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MediaOwnerType, Prisma, Tour } from '@prisma/client';
import { slugify } from '../../common/slugify';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { CreateTourDto } from './dto/create-tour.dto';
import { ListToursQueryDto } from './dto/list-tours-query.dto';
import { UpdateTourDto } from './dto/update-tour.dto';

/**
 * Pagination envelope returned by `findPublishedList`.
 *
 * The `TransformInterceptor` recognises the `{ items, meta }` shape and
 * hoists `meta` to the response envelope top level, so consumers see
 * `{ data: items, error: null, meta }`.
 */
/**
 * Per-card aggregate stats joined onto every public Tour payload.
 *
 *  - `averageRating` — mean of approved-only review ratings; `null` when
 *    no approved reviews exist (FE renders "no rating yet" instead of "0★").
 *  - `reviewsCount`  — count of approved reviews. Drafts never inflate this.
 *  - `peopleGoing`   — total `seatsBooked` across the tour's departures.
 *    Drives the "120+ People" badge on Figma tour cards. Includes all
 *    statuses, since the seat counter only ever goes up on PAID + down
 *    on admin refund.
 */
export interface TourStats {
  averageRating: number | null;
  reviewsCount: number;
  peopleGoing: number;
}

export type TourWithStats = Tour & TourStats;

export interface PaginatedTours {
  items: TourWithStats[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Owns CRUD for the `Tour` table. Public list/detail and itinerary CRUD
 * arrive in later sub-features (B2.3 + B2.4); this service is currently
 * scoped to admin-only mutations + read-by-slug.
 *
 * Two error families are mapped to clean HTTP statuses:
 *  - `P2002` (unique constraint) → 409 `TOUR_SLUG_EXISTS`
 *  - `P2003` (FK violation)      → 400 `INVALID_DESTINATION` / 409 on delete
 *
 * Reads use Prisma's `include: { destination: true }` so admin UIs can
 * render the relation without a follow-up join.
 */
@Injectable()
export class ToursService {
  private readonly logger = new Logger(ToursService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────
  // Public reads
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Public list — paginated, only `is_published = true`. Used by the
   * marketing FE catalog and the home-page featured shelf.
   *
   * Filter semantics (all optional, AND-combined):
   *  - `destination` is a SLUG; we resolve to id eagerly. Missing slug →
   *    empty result set (not a 404 — empty is the honest answer for a
   *    catalog browse).
   *  - `minPrice` / `maxPrice` are inclusive bounds on `basePrice`.
   *  - `duration` is an exact day-count match.
   *  - `featured` opts into `is_featured = true`.
   *  - `q` is case-insensitive substring search across both languages of
   *    title and summary.
   *
   * Sort whitelist is enforced in the DTO; default is newest first.
   *
   * Runs list + count with `Promise.all` (NOT `$transaction`) — the Supabase
   * transaction-mode pooler (connection_limit=1) can't start a batch transaction
   * under concurrency; a paginated count needs no cross-query snapshot consistency.
   */
  async findPublishedList(query: ListToursQueryDto): Promise<PaginatedTours> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const destinationId = await this.resolveDestinationFilter(
      query.destination,
    );
    // The slug was supplied but doesn't exist — short-circuit to empty
    // rather than running a query with `destinationId: undefined` that
    // would silently broaden the result set.
    if (query.destination && destinationId === null) {
      return {
        items: [],
        meta: { page, pageSize, total: 0, totalPages: 1 },
      };
    }

    const where = this.buildPublishedWhere(query, destinationId);

    // Read-only list+count: use Promise.all (NOT $transaction) — the Supabase
    // transaction-mode pooler (connection_limit=1) can't start a batch transaction
    // under concurrency; pagination needs no cross-query snapshot consistency.
    const [items, total] = await Promise.all([
      this.prisma.tour.findMany({
        where,
        include: { destination: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.tour.count({ where }),
    ]);

    const stats = await this.computeStats(items.map((t) => t.id));
    const itemsWithStats: TourWithStats[] = items.map((t) => ({
      ...t,
      ...(stats.get(t.id) ?? emptyStats()),
    }));
    const itemsWithMedia = await this.media.attachToOwners(
      MediaOwnerType.TOUR,
      itemsWithStats,
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
   * Public detail — fetch by slug, only if published.
   *
   * Includes:
   *  - `destination` — for breadcrumbs.
   *  - `itinerary`   — sorted ascending so the FE renders Day 1 → N in
   *                    order without a client-side sort.
   *
   * @throws NotFoundException — slug missing OR unpublished. We deliberately
   *         conflate the two cases so unpublished drafts aren't discoverable
   *         via 200-vs-404 probing.
   */
  async findPublishedBySlug(slug: string): Promise<TourWithStats> {
    const tour = await this.prisma.tour.findFirst({
      where: { slug, isPublished: true },
      include: {
        destination: true,
        itinerary: { orderBy: { dayNumber: 'asc' } },
      },
    });
    if (!tour) {
      throw new NotFoundException({
        code: 'TOUR_NOT_FOUND',
        message: `Tour "${slug}" not found`,
      });
    }
    const stats = await this.computeStats([tour.id]);
    return this.media.attachToOwner(MediaOwnerType.TOUR, {
      ...tour,
      ...(stats.get(tour.id) ?? emptyStats()),
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Admin reads
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Admin: fetch one tour by slug, no `is_published` filter.
   * Returns the row with its parent `destination` joined.
   *
   * @throws NotFoundException — slug missing.
   */
  async findBySlug(slug: string): Promise<Tour> {
    const tour = await this.prisma.tour.findUnique({
      where: { slug },
      include: { destination: true },
    });
    if (!tour) {
      throw new NotFoundException({
        code: 'TOUR_NOT_FOUND',
        message: `Tour "${slug}" not found`,
      });
    }
    return this.media.attachToOwner(MediaOwnerType.TOUR, tour);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Mutations
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Creates a new tour.
   *
   * Validation order:
   *  1. Pre-flight check: the referenced `destinationId` must exist.
   *     We check eagerly (instead of letting Postgres throw FK error) so
   *     the user gets a stable `INVALID_DESTINATION` code rather than a
   *     generic Prisma error string.
   *  2. Insert the row. Prisma's `P2002` (slug unique) → 409.
   *
   * Defaults applied here (rather than DB defaults so the API contract is
   * explicit):
   *  - `currency` → 'USD' (uppercased)
   *  - `category` → DAY
   *  - `included / excluded` → empty arrays
   *  - `isPublished / isFeatured` → false (drafts by default — admin can
   *    choose to publish on creation)
   *
   * @param body  Validated DTO.
   * @returns     The created row with the destination joined.
   */
  async create(body: CreateTourDto): Promise<Tour> {
    await this.assertDestinationExists(body.destinationId);
    // Normalize ANY admin input; omitted slug falls back to titleEn.
    // Symbol-only input → 400 INVALID_SLUG.
    const slug = this.normalizeSlug(body.slug, body.titleEn);
    try {
      const tour = await this.prisma.$transaction(async (tx) => {
        const created = await tx.tour.create({
          data: this.mapCreatePayload(body, slug),
          include: { destination: true },
        });
        if (body.media) {
          await this.media.syncAssets(
            tx,
            MediaOwnerType.TOUR,
            created.id,
            body.media,
          );
        }
        return created;
      });
      this.logger.log(`Created tour ${tour.slug} (id=${tour.id})`);
      return this.media.attachToOwner(MediaOwnerType.TOUR, tour);
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictException({
          code: 'TOUR_SLUG_EXISTS',
          message: `Slug "${body.slug}" is already in use`,
        });
      }
      throw err;
    }
  }

  /**
   * Partial update.
   *
   * If the body includes `destinationId`, we re-validate that the new
   * destination exists. Empty body is a no-op (Prisma still hits the DB
   * but returns the row unchanged).
   *
   * @throws NotFoundException — slug missing.
   * @throws BadRequestException — destinationId points to a missing row.
   * @throws ConflictException — body changes `slug` to an existing one.
   */
  async update(slug: string, body: UpdateTourDto): Promise<Tour> {
    await this.findBySlug(slug); // 404 early
    if (body.destinationId) {
      await this.assertDestinationExists(body.destinationId);
    }
    // Same normalization as create when the PATCH renames the slug.
    if (body.slug !== undefined) {
      body = { ...body, slug: this.normalizeSlug(body.slug, body.titleEn) };
    }
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.tour.update({
          where: { slug },
          data: this.mapUpdatePayload(body),
          include: { destination: true },
        });
        if (body.media) {
          await this.media.syncAssets(
            tx,
            MediaOwnerType.TOUR,
            row.id,
            body.media,
          );
        }
        return row;
      });
      this.logger.log(`Updated tour ${updated.slug} (id=${updated.id})`);
      return this.media.attachToOwner(MediaOwnerType.TOUR, updated);
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictException({
          code: 'TOUR_SLUG_EXISTS',
          message: `Slug "${body.slug}" is already in use`,
        });
      }
      throw err;
    }
  }

  /**
   * Hard delete.
   *
   * Tour has children (departures, bookings, reviews, wishlist) with
   * `onDelete: Cascade` (departures, itinerary, reviews, wishlist) or
   * `Restrict` (bookings). So if any booking references this tour, the DB
   * raises `P2003` and we translate to 409.
   *
   * @throws NotFoundException — slug missing.
   * @throws ConflictException — tour still has bookings.
   */
  async remove(slug: string): Promise<Tour> {
    const tour = await this.findBySlug(slug);
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.media.deleteForOwner(tx, MediaOwnerType.TOUR, tour.id);
        await tx.tour.delete({ where: { slug } });
      });
      this.logger.log(`Deleted tour ${tour.slug} (id=${tour.id})`);
      return tour;
    } catch (err) {
      if (this.isForeignKeyError(err)) {
        throw new ConflictException({
          code: 'TOUR_HAS_BOOKINGS',
          message:
            'Cannot delete tour while bookings reference it. ' +
            'Cancel or refund the bookings first.',
        });
      }
      throw err;
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Resolves the optional `destination` slug filter to a UUID. Returns:
   *  - `undefined` when no slug was supplied (filter inactive)
   *  - `null` when a slug was supplied but no destination matches
   *    (caller treats this as "no rows possible")
   *  - the id string when the slug resolves
   */
  private async resolveDestinationFilter(
    slug: string | undefined,
  ): Promise<string | null | undefined> {
    if (!slug) return undefined;
    const row = await this.prisma.destination.findUnique({
      where: { slug },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  /**
   * Builds the `where` clause for the public list endpoint. Always pins
   * `isPublished: true`; merges every optional filter the caller supplied.
   *
   * `destinationId` is passed in (already resolved from slug) so this
   * function stays synchronous and unit-testable without a Prisma mock.
   */
  private buildPublishedWhere(
    query: ListToursQueryDto,
    destinationId: string | null | undefined,
  ): Prisma.TourWhereInput {
    const search = query.q?.trim();
    const priceFilter: Prisma.DecimalFilter = {};
    if (query.minPrice !== undefined) priceFilter.gte = query.minPrice;
    if (query.maxPrice !== undefined) priceFilter.lte = query.maxPrice;

    return {
      isPublished: true,
      ...(destinationId ? { destinationId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.duration !== undefined ? { durationDays: query.duration } : {}),
      ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
      ...(Object.keys(priceFilter).length > 0
        ? { basePrice: priceFilter }
        : {}),
      ...(search
        ? {
            OR: [
              { titleEn: { contains: search, mode: 'insensitive' } },
              { titleVi: { contains: search, mode: 'insensitive' } },
              { summaryEn: { contains: search, mode: 'insensitive' } },
              { summaryVi: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  /**
   * Throws `BadRequestException` with code `INVALID_DESTINATION` when the
   * supplied destination UUID isn't backed by a row.
   *
   * Why pre-validate? Postgres' FK error (P2003) doesn't tell the client
   * WHICH FK failed, and Prisma's error message is generic. Catching it
   * eagerly here gives a clear, stable code.
   */
  private async assertDestinationExists(destinationId: string): Promise<void> {
    const exists = await this.prisma.destination.findUnique({
      where: { id: destinationId },
      select: { id: true },
    });
    if (!exists) {
      throw new BadRequestException({
        code: 'INVALID_DESTINATION',
        message: `Destination "${destinationId}" does not exist`,
      });
    }
  }

  /**
   * Builds the strongly-typed `Prisma.TourCreateInput` from the loose DTO
   * shape, applying defaults consistently so DB-level defaults don't
   * silently disagree with the API contract.
   */
  /**
   * Normalizes (or generates, when `provided` is absent/blank) the slug.
   * Cap 120 chars mirrors the DB `VarChar(120)`; a trailing hyphen left by
   * the cut is trimmed so the result stays canonical kebab.
   *
   * @throws BadRequestException — `INVALID_SLUG` when nothing usable remains.
   */
  private normalizeSlug(
    provided: string | undefined,
    fallback?: string,
  ): string {
    const source = provided?.trim() ? provided : (fallback ?? '');
    const normalized = slugify(source).slice(0, 120).replace(/-+$/, '');
    if (!normalized) {
      throw new BadRequestException({
        code: 'INVALID_SLUG',
        message:
          'Slug (or titleEn fallback) contains no usable characters after normalization',
      });
    }
    return normalized;
  }

  private mapCreatePayload(
    body: CreateTourDto,
    slug: string,
  ): Prisma.TourCreateInput {
    return {
      slug,
      titleEn: body.titleEn,
      titleVi: body.titleVi,
      summaryEn: body.summaryEn,
      summaryVi: body.summaryVi,
      destination: { connect: { id: body.destinationId } },
      durationDays: body.durationDays,
      maxGroupSize: body.maxGroupSize ?? 20,
      basePrice: new Prisma.Decimal(body.basePrice),
      currency: (body.currency ?? 'USD').toUpperCase(),
      category: body.category,
      difficulty: body.difficulty,
      isPublished: body.isPublished ?? false,
      isFeatured: body.isFeatured ?? false,
      included: body.included ?? [],
      excluded: body.excluded ?? [],
      meetingPoint: body.meetingPoint,
    };
  }

  /**
   * Builds the strongly-typed `Prisma.TourUpdateInput` from the partial
   * DTO. Each field is only included when explicitly sent — undefined
   * properties are stripped so re-PATCHing with an empty body never
   * accidentally clears existing values.
   *
   * `destinationId` is mapped to a `connect` operation when present.
   */
  private mapUpdatePayload(body: UpdateTourDto): Prisma.TourUpdateInput {
    const data: Prisma.TourUpdateInput = {};
    if (body.slug !== undefined) data.slug = body.slug;
    if (body.titleEn !== undefined) data.titleEn = body.titleEn;
    if (body.titleVi !== undefined) data.titleVi = body.titleVi;
    if (body.summaryEn !== undefined) data.summaryEn = body.summaryEn;
    if (body.summaryVi !== undefined) data.summaryVi = body.summaryVi;
    if (body.destinationId !== undefined) {
      data.destination = { connect: { id: body.destinationId } };
    }
    if (body.durationDays !== undefined) data.durationDays = body.durationDays;
    if (body.maxGroupSize !== undefined) data.maxGroupSize = body.maxGroupSize;
    if (body.basePrice !== undefined) {
      data.basePrice = new Prisma.Decimal(body.basePrice);
    }
    if (body.currency !== undefined)
      data.currency = body.currency.toUpperCase();
    if (body.category !== undefined) data.category = body.category;
    if (body.difficulty !== undefined) data.difficulty = body.difficulty;
    if (body.isPublished !== undefined) data.isPublished = body.isPublished;
    if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured;
    if (body.included !== undefined) data.included = body.included;
    if (body.excluded !== undefined) data.excluded = body.excluded;
    if (body.meetingPoint !== undefined) data.meetingPoint = body.meetingPoint;
    return data;
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

  /**
   * Aggregates approved-review averages + count and departure seat sums
   * for the supplied tour ids. Returns a Map so callers can join by id
   * without re-scanning arrays.
   *
   * Two queries in parallel (both indexed):
   *  - `reviews.groupBy` filtered on `isApproved` — uses
   *    `reviews(tour_id, is_approved)` index.
   *  - `tour_departures.groupBy _sum.seatsBooked` — sequential scan on
   *    the small departure set is fine; the index isn't needed.
   *
   * Empty input list short-circuits to an empty map so a zero-result
   * tour list doesn't fire two no-op queries.
   */
  private async computeStats(
    tourIds: string[],
  ): Promise<Map<string, TourStats>> {
    if (tourIds.length === 0) return new Map();
    const [reviewGroups, seatGroups] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['tourId'],
        where: { tourId: { in: tourIds }, isApproved: true },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.tourDeparture.groupBy({
        by: ['tourId'],
        where: { tourId: { in: tourIds } },
        _sum: { seatsBooked: true },
      }),
    ]);
    const map = new Map<string, TourStats>();
    for (const id of tourIds) {
      map.set(id, emptyStats());
    }
    for (const r of reviewGroups) {
      const entry = map.get(r.tourId);
      if (entry) {
        entry.averageRating = r._avg.rating;
        entry.reviewsCount = r._count._all;
      }
    }
    for (const s of seatGroups) {
      const entry = map.get(s.tourId);
      if (entry) {
        entry.peopleGoing = s._sum.seatsBooked ?? 0;
      }
    }
    return map;
  }
}

/** Zero-value stats for tours with no reviews or no departures yet. */
function emptyStats(): TourStats {
  return { averageRating: null, reviewsCount: 0, peopleGoing: 0 };
}
