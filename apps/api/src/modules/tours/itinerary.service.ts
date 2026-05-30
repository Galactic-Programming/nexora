import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TourItineraryDay } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateItineraryDayDto } from './dto/create-itinerary-day.dto';
import { UpdateItineraryDayDto } from './dto/update-itinerary-day.dto';

/**
 * Owns nested CRUD for `TourItineraryDay` rows under a parent tour.
 *
 * All routes are addressed by `(tourSlug, dayNumber)` rather than UUID
 * — humans (and Postman) read URLs like
 * `/admin/tours/hoi-an-walking/itinerary/3` far more easily than UUIDs,
 * and (tourId, dayNumber) is already a unique pair at the DB level.
 *
 * Error mapping:
 *  - Parent tour slug missing       → 404 `TOUR_NOT_FOUND`
 *  - Day number missing under tour  → 404 `ITINERARY_DAY_NOT_FOUND`
 *  - Duplicate `(tourId, dayNumber)` on insert / re-number → 409
 *    `ITINERARY_DAY_EXISTS`
 *
 * Tour deletion cascades to itinerary rows (`onDelete: Cascade` in the
 * schema), so we don't have to clean up here.
 */
@Injectable()
export class ItineraryService {
  private readonly logger = new Logger(ItineraryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists every day of a tour's itinerary, sorted ascending so admins
   * always see Day 1, 2, 3, ... in order.
   *
   * @throws NotFoundException — slug missing.
   */
  async listForTour(slug: string): Promise<TourItineraryDay[]> {
    const tour = await this.findTourBySlugOrThrow(slug);
    return this.prisma.tourItineraryDay.findMany({
      where: { tourId: tour.id },
      orderBy: { dayNumber: 'asc' },
    });
  }

  /**
   * Creates a new itinerary day for the given tour.
   *
   * @throws NotFoundException — tour slug missing.
   * @throws ConflictException — day number already exists for this tour.
   */
  async create(
    slug: string,
    body: CreateItineraryDayDto,
  ): Promise<TourItineraryDay> {
    const tour = await this.findTourBySlugOrThrow(slug);
    try {
      const day = await this.prisma.tourItineraryDay.create({
        data: {
          tour: { connect: { id: tour.id } },
          dayNumber: body.dayNumber,
          titleEn: body.titleEn,
          titleVi: body.titleVi,
          descriptionEn: body.descriptionEn,
          descriptionVi: body.descriptionVi,
        },
      });
      this.logger.log(
        `Created itinerary day ${day.dayNumber} for tour ${slug} (id=${day.id})`,
      );
      return day;
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictException({
          code: 'ITINERARY_DAY_EXISTS',
          message: `Day ${body.dayNumber} already exists for tour "${slug}"`,
        });
      }
      throw err;
    }
  }

  /**
   * Partial update. Supports renumbering — sending `dayNumber` in the
   * body is allowed, but is subject to the same uniqueness constraint.
   *
   * Empty body is a no-op (Prisma still hits the DB but returns the row
   * unchanged).
   *
   * @throws NotFoundException — tour slug or day number missing.
   * @throws ConflictException — renumber collides with an existing day.
   */
  async update(
    slug: string,
    dayNumber: number,
    body: UpdateItineraryDayDto,
  ): Promise<TourItineraryDay> {
    const existing = await this.findDayOrThrow(slug, dayNumber);
    try {
      return await this.prisma.tourItineraryDay.update({
        where: { id: existing.id },
        data: this.mapUpdatePayload(body),
      });
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictException({
          code: 'ITINERARY_DAY_EXISTS',
          message: `Day ${body.dayNumber} already exists for tour "${slug}"`,
        });
      }
      throw err;
    }
  }

  /**
   * Removes one itinerary day. Returns the deleted row so admins can
   * confirm what was removed.
   *
   * @throws NotFoundException — tour slug or day number missing.
   */
  async remove(slug: string, dayNumber: number): Promise<TourItineraryDay> {
    const existing = await this.findDayOrThrow(slug, dayNumber);
    await this.prisma.tourItineraryDay.delete({ where: { id: existing.id } });
    this.logger.log(
      `Deleted itinerary day ${existing.dayNumber} from tour ${slug} (id=${existing.id})`,
    );
    return existing;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Resolves a tour by slug. Used everywhere so the parent-missing case
   * always surfaces a clean `TOUR_NOT_FOUND` regardless of which child
   * operation triggered it.
   *
   * We only select `id` because callers don't need any other field —
   * smaller round-trip + smaller in-memory footprint.
   */
  private async findTourBySlugOrThrow(slug: string): Promise<{ id: string }> {
    const tour = await this.prisma.tour.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!tour) {
      throw new NotFoundException({
        code: 'TOUR_NOT_FOUND',
        message: `Tour "${slug}" not found`,
      });
    }
    return tour;
  }

  /**
   * Resolves a `(slug, dayNumber)` pair to a full row. Two 404s are
   * possible — distinct error codes so the FE can tell which.
   */
  private async findDayOrThrow(
    slug: string,
    dayNumber: number,
  ): Promise<TourItineraryDay> {
    const tour = await this.findTourBySlugOrThrow(slug);
    const day = await this.prisma.tourItineraryDay.findUnique({
      where: { tourId_dayNumber: { tourId: tour.id, dayNumber } },
    });
    if (!day) {
      throw new NotFoundException({
        code: 'ITINERARY_DAY_NOT_FOUND',
        message: `Day ${dayNumber} not found for tour "${slug}"`,
      });
    }
    return day;
  }

  /**
   * Builds the partial update payload, skipping any field the caller did
   * not explicitly send — undefined values must not blank out existing
   * data on a PATCH.
   */
  private mapUpdatePayload(
    body: UpdateItineraryDayDto,
  ): Prisma.TourItineraryDayUpdateInput {
    const data: Prisma.TourItineraryDayUpdateInput = {};
    if (body.dayNumber !== undefined) data.dayNumber = body.dayNumber;
    if (body.titleEn !== undefined) data.titleEn = body.titleEn;
    if (body.titleVi !== undefined) data.titleVi = body.titleVi;
    if (body.descriptionEn !== undefined) {
      data.descriptionEn = body.descriptionEn;
    }
    if (body.descriptionVi !== undefined) {
      data.descriptionVi = body.descriptionVi;
    }
    return data;
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    );
  }
}
