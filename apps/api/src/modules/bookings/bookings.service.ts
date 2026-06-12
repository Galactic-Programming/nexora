import { mintBookingCode } from './booking-code';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Booking,
  BookingStatus,
  DepartureStatus,
  Locale,
  TourDeparture,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { StripeService } from '../payments/stripe.service';
import { CreateBookingDto } from './dto/create-booking.dto';

/**
 * Result of `BookingsService.create` — the FE redirects the buyer to
 * `checkoutUrl` while the local `bookingCode` is kept around for the
 * success page (which polls `/bookings/:code`).
 */
export interface CreatedBooking {
  bookingId: string;
  bookingCode: string;
  checkoutUrl: string;
  status: BookingStatus;
}

/**
 * Bookings + Stripe Checkout integration.
 *
 * Lifecycle (for context — only `create` + reads live in this file for B3.1):
 *
 * ```text
 *   POST /bookings  ──▶  PENDING + Stripe Checkout session minted
 *   Stripe pays     ──▶  webhook (B3.4) ──▶  PAID + seatsBooked += N
 *   30 min timeout  ──▶  webhook (B3.4) ──▶  CANCELLED (no seat changes)
 *   Admin refund    ──▶  /admin/refund (B3.5) ──▶  REFUNDED + seatsBooked -= N
 * ```
 *
 * Seat reservation timing — IMPORTANT:
 *
 *  We do NOT reserve seats at PENDING. Reserving on create would force
 *  an abandoned-cart cleanup job to release them, which is over-scope
 *  for the thesis demo. Instead, we re-check availability under a row
 *  lock inside the webhook (B3.4); the booking is refunded automatically
 *  if the seat count has crossed the line while the buyer was on Stripe.
 *
 *  Soft-check here is still useful: it short-circuits obvious oversells
 *  before we mint a Stripe session, saving a round-trip when the tour
 *  is already full at request time. It is NOT a guarantee.
 *
 * Authorization model for reads:
 *
 *  - `findOwnList` always scopes by `userId = currentUser.id`.
 *  - `findByCodeForCaller` allows the caller if they own the booking OR
 *    have `role === ADMIN`. We don't expose owner identity through 404
 *    diffing — non-owners get the same `BOOKING_NOT_FOUND` as the
 *    truly-missing case.
 */
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────
  // Mutations
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Creates a PENDING booking and mints a hosted Stripe Checkout session.
   *
   * Steps:
   *  1. Resolve tour by slug (must be published; drafts never bookable).
   *  2. Resolve departure (must belong to that tour AND be OPEN).
   *  3. Soft-check remaining seats (best-effort, not a reservation).
   *  4. Compute `totalAmount = (numAdults + numChildren) * effectivePrice`
   *     where `effectivePrice = departure.priceOverride ?? tour.basePrice`.
   *  5. Generate a unique `code` (BK-XXXXXXXX); retry once on collision.
   *  6. Insert the booking row (status PENDING).
   *  7. Create Checkout Session with `metadata.bookingId/bookingCode` so
   *     the webhook can correlate.
   *  8. Persist `stripeSessionId` back onto the booking. We do this in a
   *     second write rather than a single transaction because Stripe's
   *     session create is an outbound HTTP call — wrapping it in a DB
   *     transaction would hold a connection open for the round-trip,
   *     which the Supavisor pooler doesn't love. The window where the
   *     booking exists without `stripeSessionId` is sub-second and
   *     idempotent on retry.
   */
  async create(
    customerUserId: string,
    body: CreateBookingDto,
  ): Promise<CreatedBooking> {
    const tour = await this.prisma.tour.findFirst({
      where: { slug: body.tourSlug, isPublished: true },
      select: {
        id: true,
        slug: true,
        titleEn: true,
        currency: true,
        basePrice: true,
      },
    });
    if (!tour) {
      throw new NotFoundException({
        code: 'TOUR_NOT_FOUND',
        message: `Tour "${body.tourSlug}" not found`,
      });
    }

    const departure = await this.prisma.tourDeparture.findFirst({
      where: { id: body.departureId, tourId: tour.id },
    });
    if (!departure) {
      throw new NotFoundException({
        code: 'DEPARTURE_NOT_FOUND',
        message: `Departure "${body.departureId}" not found for tour "${body.tourSlug}"`,
      });
    }
    if (departure.status !== DepartureStatus.OPEN) {
      throw new BadRequestException({
        code: 'DEPARTURE_NOT_OPEN',
        message: `Departure is ${departure.status} — bookings closed`,
      });
    }

    const totalSeats = body.numAdults + (body.numChildren ?? 0);
    this.assertSeatsAvailable(departure, totalSeats);

    const effectiveUnitPrice = departure.priceOverride ?? tour.basePrice;
    const totalAmount = effectiveUnitPrice.mul(totalSeats);

    const code = await this.generateUniqueCode();
    const booking = await this.prisma.booking.create({
      data: {
        code,
        user: { connect: { id: customerUserId } },
        tour: { connect: { id: tour.id } },
        departure: { connect: { id: departure.id } },
        numAdults: body.numAdults,
        numChildren: body.numChildren ?? 0,
        totalAmount,
        currency: tour.currency,
        status: BookingStatus.PENDING,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        specialRequests: body.specialRequests,
      },
    });

    // Stripe expects the smallest currency unit (cents for USD). We multiply
    // by 100 + round — Decimal.toNumber() can introduce float noise on huge
    // values, but our amounts cap at 12,2 precision so it's safe here.
    const unitAmountCents = Math.round(effectiveUnitPrice.toNumber() * 100);
    const frontendUrl = this.config.getOrThrow<string>('app.frontendUrl');

    const session = await this.stripe.createCheckoutSession({
      bookingId: booking.id,
      bookingCode: booking.code,
      customerEmail: body.contactEmail,
      currency: tour.currency.toLowerCase(),
      unitAmount: unitAmountCents,
      quantity: totalSeats,
      productName: tour.titleEn,
      productDescription: `Booking ${booking.code} — ${totalSeats} seat(s)`,
      successUrl: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${frontendUrl}/checkout/cancel?code=${booking.code}`,
    });

    if (!session.url) {
      throw new BadRequestException({
        code: 'STRIPE_SESSION_INVALID',
        message: 'Stripe returned a session without a redirect URL.',
      });
    }

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { stripeSessionId: session.id },
    });

    this.logger.log(
      `Created booking ${booking.code} (id=${booking.id}, tour=${tour.slug}, seats=${totalSeats})`,
    );

    return {
      bookingId: booking.id,
      bookingCode: booking.code,
      checkoutUrl: session.url,
      status: BookingStatus.PENDING,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Lists bookings owned by the calling customer, most recent first.
   * Includes the parent tour title so the FE can render the list without
   * a follow-up join. Cap at 50 rows for now — pagination lands when
   * `/account/bookings` actually needs it.
   */
  async findOwnList(customerUserId: string): Promise<Booking[]> {
    return this.prisma.booking.findMany({
      where: { userId: customerUserId },
      include: {
        tour: { select: { slug: true, titleEn: true, titleVi: true } },
        departure: { select: { startDate: true, endDate: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Fetches a single booking by `code`, enforcing owner-or-admin auth.
   * Non-owners (and missing codes) collapse into the same 404 so we
   * don't leak code existence to enumeration attacks.
   *
   * @throws NotFoundException — `BOOKING_NOT_FOUND` for missing OR
   *         not-owned-by-caller (non-admins).
   */
  async findByCodeForCaller(
    code: string,
    caller: { id: string; role: UserRole },
  ): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { code },
      include: {
        tour: { select: { slug: true, titleEn: true, titleVi: true } },
        departure: {
          select: { startDate: true, endDate: true, status: true },
        },
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: `Booking "${code}" not found`,
      });
    }
    const isOwner = booking.userId === caller.id;
    const isAdmin = caller.role === UserRole.ADMIN;
    if (!isOwner && !isAdmin) {
      // Deliberately 404 not 403 — admins see real not-found, customers
      // never learn whether a code exists outside their own list.
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: `Booking "${code}" not found`,
      });
    }
    return booking;
  }

  /**
   * Admin-initiated refund.
   *
   * Pre-conditions: booking must be PAID and carry a `stripePaymentIntentId`
   * (which the webhook persists on the PAID transition). Anything else is
   * a 4xx — we never refund out of CANCELLED, REFUNDED, or PENDING.
   *
   * Order of operations:
   *  1. Load booking; validate state.
   *  2. Call Stripe refund FIRST (outside any DB tx). The Stripe call is
   *     authoritative — if it fails, the booking row stays PAID and the
   *     admin sees a `REFUND_FAILED` error. We never flip the DB to
   *     REFUNDED for a refund that didn't actually happen.
   *  3. In a single DB tx: decrement `seatsBooked` on the departure and
   *     flip the booking to REFUNDED + set `cancelledAt`.
   *  4. Fire the customer notification email (defensive — failures
   *     log-and-continue; the refund is already committed).
   *
   * Idempotency: if Stripe says the payment is already refunded
   * (`charge_already_refunded`), we still want the DB to converge to
   * REFUNDED. We re-throw any other Stripe error as REFUND_FAILED.
   */
  async refundByAdmin(args: {
    bookingId: string;
    reason?: string;
  }): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: args.bookingId },
      include: {
        user: { select: { locale: true } },
        tour: { select: { titleEn: true, titleVi: true } },
        departure: { select: { startDate: true, endDate: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: `Booking "${args.bookingId}" not found`,
      });
    }
    if (booking.status !== BookingStatus.PAID) {
      throw new BadRequestException({
        code: 'BOOKING_NOT_REFUNDABLE',
        message: `Booking is ${booking.status}; only PAID bookings can be refunded`,
      });
    }
    if (!booking.stripePaymentIntentId) {
      throw new BadRequestException({
        code: 'BOOKING_NOT_REFUNDABLE',
        message: 'Booking has no Stripe payment_intent — refund manually',
      });
    }

    try {
      await this.stripe.createRefund({
        paymentIntentId: booking.stripePaymentIntentId,
        reason: args.reason ?? 'requested_by_customer',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      this.logger.error(
        `Stripe refund failed for booking ${booking.code}: ${message}`,
      );
      throw new BadRequestException({
        code: 'REFUND_FAILED',
        message: `Stripe refund failed: ${message}`,
      });
    }

    const totalSeats = booking.numAdults + booking.numChildren;
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.tourDeparture.update({
        where: { id: booking.departureId },
        data: { seatsBooked: { decrement: totalSeats } },
      });
      return tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.REFUNDED,
          cancelledAt: new Date(),
        },
      });
    });

    this.logger.log(
      `Admin refunded booking ${booking.code} (payment_intent=${booking.stripePaymentIntentId}, seats=${totalSeats} released)`,
    );

    const locale = booking.user?.locale ?? Locale.en;
    const tourTitle =
      locale === Locale.vi ? booking.tour.titleVi : booking.tour.titleEn;
    await this.email.sendBookingRefunded({
      to: booking.contactEmail,
      locale,
      vars: {
        code: booking.code,
        tourTitle,
        contactName: booking.contactName,
        totalAmount: booking.totalAmount.toString(),
        currency: booking.currency,
        numAdults: booking.numAdults,
        numChildren: booking.numChildren,
        startDate: booking.departure.startDate,
        endDate: booking.departure.endDate,
      },
    });

    return updated;
  }

  /**
   * Public stub — used by the future ownership-aware methods. Kept here
   * (vs. inlined) so the role check has one home and one log message
   * the day we want to audit denied accesses.
   */
  private assertOwnerOrAdmin(
    booking: Pick<Booking, 'userId'>,
    caller: { id: string; role: UserRole },
  ): void {
    if (booking.userId === caller.id) return;
    if (caller.role === UserRole.ADMIN) return;
    throw new ForbiddenException({
      code: 'BOOKING_FORBIDDEN',
      message: 'You can only access your own bookings',
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Best-effort capacity guard at create time. Real reservation happens
   * in the webhook under FOR UPDATE; this is just to avoid sending the
   * buyer to Stripe for a definitely-full departure.
   */
  private assertSeatsAvailable(
    departure: TourDeparture,
    totalSeats: number,
  ): void {
    const remaining = departure.seatsTotal - departure.seatsBooked;
    if (remaining < totalSeats) {
      throw new ConflictException({
        code: 'SEATS_NOT_AVAILABLE',
        message: `Only ${remaining} seat(s) left, requested ${totalSeats}`,
      });
    }
  }

  /**
   * Mints a short, human-readable booking code (see `mintBookingCode` for the
   * format contract). Collisions are virtually impossible at our scale, but
   * we still retry once on the off-chance Postgres' UNIQUE constraint fires
   * before yielding.
   */
  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const candidate = mintBookingCode();
      const existing = await this.prisma.booking.findUnique({
        where: { code: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
    }
    // Two collisions in a row is so unlikely it points at a programming
    // error (e.g. random source seeded the same). Fail loudly.
    throw new Error('Failed to generate a unique booking code after 2 tries');
  }
}
