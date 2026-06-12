import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DepartureStatus, Prisma, TourDeparture } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDepartureDto } from './dto/create-departure.dto';
import { ListDeparturesQueryDto } from './dto/list-departures-query.dto';
import { UpdateDepartureDto } from './dto/update-departure.dto';

/**
 * Owns CRUD for `TourDeparture` rows nested under a parent tour.
 *
 * Two surfaces share this service:
 *  - **Public** — `findPublicListForTour` filters to `tour.isPublished`,
 *    defaults `from = today` and `status = OPEN`. End users never see
 *    past or cancelled departures unless they explicitly opt in.
 *  - **Admin** — `findAdminListForTour` honours every filter literally,
 *    no `isPublished` gate, no implicit `from` cutoff. Operators see the
 *    full history (CLOSED / CANCELLED rows included) for audit.
 *
 * Capacity invariant: `seatsTotal >= seatsBooked` is enforced on update.
 * `seatsBooked` is never accepted from clients — it's mutated only by
 * the booking flow (Sprint B3) under transaction + row lock.
 *
 * Error mapping:
 *  - Parent tour slug missing                 → 404 `TOUR_NOT_FOUND`
 *  - Departure id missing under that tour     → 404 `DEPARTURE_NOT_FOUND`
 *  - `endDate < startDate`                    → 400 `INVALID_DATE_RANGE`
 *  - Update tries to lower capacity below seats already sold
 *                                             → 400 `SEATS_TOTAL_BELOW_BOOKED`
 *  - Delete with `seatsBooked > 0` (or P2003) → 409 `DEPARTURE_HAS_BOOKINGS`
 */
@Injectable()
export class DeparturesService {
  private readonly logger = new Logger(DeparturesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ────────────────────────────────────────────────────────────────────────
  // Reads — public
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Public list for one tour. Pins:
   *  - `tour.isPublished = true` (404 if draft)
   *  - `startDate >= from` (defaults to today)
   *  - `status` = caller's filter, or `OPEN` if not supplied
   *
   * Returns rows sorted by `startDate` ascending so the FE can render a
   * date-picker without re-sorting.
   */
  async findPublicListForTour(
    slug: string,
    query: ListDeparturesQueryDto,
  ): Promise<TourDeparture[]> {
    const tour = await this.findPublishedTourBySlugOrThrow(slug);

    const from = query.from ? new Date(query.from) : this.startOfToday();
    const status = query.status ?? DepartureStatus.OPEN;

    const where: Prisma.TourDepartureWhereInput = {
      tourId: tour.id,
      startDate: this.buildDateFilter(from, query.to),
      status,
    };

    return this.prisma.tourDeparture.findMany({
      where,
      orderBy: { startDate: 'asc' },
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Reads — admin
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Admin list. No `isPublished` gate; no implicit `from` default. If the
   * caller omits filters they get every departure for the tour, oldest
   * first. Useful for the admin "schedule" page.
   */
  async findAdminListForTour(
    slug: string,
    query: ListDeparturesQueryDto,
  ): Promise<TourDeparture[]> {
    const tour = await this.findTourBySlugOrThrow(slug);

    const where: Prisma.TourDepartureWhereInput = {
      tourId: tour.id,
      ...(query.from || query.to
        ? {
            startDate: this.buildDateFilter(
              query.from ? new Date(query.from) : undefined,
              query.to,
            ),
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    return this.prisma.tourDeparture.findMany({
      where,
      orderBy: { startDate: 'asc' },
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Mutations — admin
  // ────────────────────────────────────────────────────────────────────────

  async create(slug: string, body: CreateDepartureDto): Promise<TourDeparture> {
    const tour = await this.findTourBySlugOrThrow(slug);
    this.assertDateRange(body.startDate, body.endDate);

    // Typo-guard: a departure must not be born already departed. Same-day is
    // allowed (walk-in sales). UTC calendar-date compare mirrors the booking
    // flow's DEPARTURE_DEPARTED check, so admin + customer agree on "past".
    const todayUtc = new Date().toISOString().slice(0, 10);
    const startUtc = new Date(body.startDate).toISOString().slice(0, 10);
    if (startUtc < todayUtc) {
      throw new BadRequestException({
        code: 'DEPARTURE_IN_PAST',
        message: `startDate ${startUtc} is in the past — departures must start today or later`,
      });
    }

    const departure = await this.prisma.tourDeparture.create({
      data: {
        tour: { connect: { id: tour.id } },
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        seatsTotal: body.seatsTotal,
        // `seatsBooked` defaults to 0 in schema — explicitly not settable
        // from this DTO because client-controlled capacity counters would
        // make seat oversell trivial.
        priceOverride:
          body.priceOverride !== undefined
            ? new Prisma.Decimal(body.priceOverride)
            : null,
        status: body.status ?? DepartureStatus.OPEN,
      },
    });

    this.logger.log(
      `Created departure ${departure.id} for tour ${slug} (start=${departure.startDate.toISOString().slice(0, 10)})`,
    );
    return departure;
  }

  async update(
    slug: string,
    id: string,
    body: UpdateDepartureDto,
  ): Promise<TourDeparture> {
    const existing = await this.findDepartureOrThrow(slug, id);

    // If only one of the two dates is in the body, validate against the
    // existing value of the other — otherwise an admin patching just
    // `startDate` could silently invert the range.
    const nextStart = body.startDate ?? existing.startDate.toISOString();
    const nextEnd = body.endDate ?? existing.endDate.toISOString();
    if (body.startDate !== undefined || body.endDate !== undefined) {
      this.assertDateRange(nextStart, nextEnd);
    }

    if (
      body.seatsTotal !== undefined &&
      body.seatsTotal < existing.seatsBooked
    ) {
      throw new BadRequestException({
        code: 'SEATS_TOTAL_BELOW_BOOKED',
        message: `Cannot reduce seatsTotal to ${body.seatsTotal} — ${existing.seatsBooked} seats are already booked`,
      });
    }

    return this.prisma.tourDeparture.update({
      where: { id: existing.id },
      data: this.mapUpdatePayload(body),
    });
  }

  async remove(slug: string, id: string): Promise<TourDeparture> {
    const existing = await this.findDepartureOrThrow(slug, id);

    // Pre-check: refuse delete when seats are already sold. Admins should
    // mark CANCELLED via PATCH instead (preserves booking history). This
    // catches the common case cleanly; the DB FK (Booking.departureId,
    // onDelete: Restrict) is the backstop against races.
    if (existing.seatsBooked > 0) {
      throw new ConflictException({
        code: 'DEPARTURE_HAS_BOOKINGS',
        message:
          `Cannot delete departure with ${existing.seatsBooked} booked seats. ` +
          'Mark it CANCELLED instead so booking history is preserved.',
      });
    }

    try {
      await this.prisma.tourDeparture.delete({ where: { id: existing.id } });
      this.logger.log(`Deleted departure ${existing.id} (tour=${slug})`);
      return existing;
    } catch (err) {
      if (this.isForeignKeyError(err)) {
        // Race condition fallback — a booking landed between the read
        // above and this delete. Surface the same 409 code so the FE
        // doesn't need to distinguish.
        throw new ConflictException({
          code: 'DEPARTURE_HAS_BOOKINGS',
          message: 'Cannot delete departure — bookings reference it.',
        });
      }
      throw err;
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────────

  /** Resolves a tour by slug. Selects only `id` (callers don't need more). */
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

  /** Public-flavoured tour lookup — also gates on `isPublished`. */
  private async findPublishedTourBySlugOrThrow(
    slug: string,
  ): Promise<{ id: string }> {
    const tour = await this.prisma.tour.findFirst({
      where: { slug, isPublished: true },
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
   * Resolves `(slug, departureId)` to a full row. Both 404s have distinct
   * codes so the FE can react differently (tour deleted vs. departure
   * deleted from a still-live tour).
   */
  private async findDepartureOrThrow(
    slug: string,
    id: string,
  ): Promise<TourDeparture> {
    const tour = await this.findTourBySlugOrThrow(slug);
    const departure = await this.prisma.tourDeparture.findFirst({
      where: { id, tourId: tour.id },
    });
    if (!departure) {
      throw new NotFoundException({
        code: 'DEPARTURE_NOT_FOUND',
        message: `Departure "${id}" not found for tour "${slug}"`,
      });
    }
    return departure;
  }

  /** Throws when `endDate < startDate`. Both args are ISO 8601 strings. */
  private assertDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: `endDate (${endDate}) must be on or after startDate (${startDate})`,
      });
    }
  }

  /**
   * Builds a Prisma `DateTimeFilter` from an inclusive `from` / `to` pair.
   * Returns `{}` (no constraint) when both are undefined.
   */
  private buildDateFilter(
    from: Date | undefined,
    to: string | undefined,
  ): Prisma.DateTimeFilter {
    const filter: Prisma.DateTimeFilter = {};
    if (from) filter.gte = from;
    if (to) filter.lte = new Date(to);
    return filter;
  }

  /** Start of the current calendar day in UTC. */
  private startOfToday(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  /**
   * Builds the partial update payload, skipping fields the caller did not
   * explicitly send. `priceOverride: null` is allowed (clears the override
   * back to the tour's base price), so we distinguish "absent" from "null".
   */
  private mapUpdatePayload(
    body: UpdateDepartureDto,
  ): Prisma.TourDepartureUpdateInput {
    const data: Prisma.TourDepartureUpdateInput = {};
    if (body.startDate !== undefined) data.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) data.endDate = new Date(body.endDate);
    if (body.seatsTotal !== undefined) data.seatsTotal = body.seatsTotal;
    if (body.priceOverride !== undefined) {
      data.priceOverride =
        body.priceOverride === null
          ? null
          : new Prisma.Decimal(body.priceOverride);
    }
    if (body.status !== undefined) data.status = body.status;
    return data;
  }

  private isForeignKeyError(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2003'
    );
  }
}
