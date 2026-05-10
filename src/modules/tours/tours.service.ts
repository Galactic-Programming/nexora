import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Tour } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';

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

  constructor(private readonly prisma: PrismaService) {}

  // ────────────────────────────────────────────────────────────────────────
  // Reads
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
    return tour;
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
   *  - `gallery / included / excluded` → empty arrays
   *  - `isPublished / isFeatured` → false (drafts by default — admin can
   *    choose to publish on creation)
   *
   * @param body  Validated DTO.
   * @returns     The created row with the destination joined.
   */
  async create(body: CreateTourDto): Promise<Tour> {
    await this.assertDestinationExists(body.destinationId);
    try {
      const tour = await this.prisma.tour.create({
        data: this.mapCreatePayload(body),
        include: { destination: true },
      });
      this.logger.log(`Created tour ${tour.slug} (id=${tour.id})`);
      return tour;
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
    try {
      const updated = await this.prisma.tour.update({
        where: { slug },
        data: this.mapUpdatePayload(body),
        include: { destination: true },
      });
      this.logger.log(`Updated tour ${updated.slug} (id=${updated.id})`);
      return updated;
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
      await this.prisma.tour.delete({ where: { slug } });
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
  private mapCreatePayload(body: CreateTourDto): Prisma.TourCreateInput {
    return {
      slug: body.slug,
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
      heroImage: body.heroImage,
      gallery: body.gallery ?? [],
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
    if (body.heroImage !== undefined) data.heroImage = body.heroImage;
    if (body.gallery !== undefined) data.gallery = body.gallery;
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
}
