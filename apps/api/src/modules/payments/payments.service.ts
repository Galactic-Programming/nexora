import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, Locale, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { StripeService } from './stripe.service';

/**
 * Stripe webhook brain. Owns the back-half of the booking lifecycle —
 * everything that happens after the buyer leaves the Checkout page.
 *
 * Idempotency model (two layers):
 *
 *  1. **Event-level**: every incoming Stripe `Event.id` is inserted into
 *     `payment_events` (UNIQUE on `stripe_event_id`). A `P2002` from
 *     that insert means we've already processed this event — Stripe is
 *     just retrying because it didn't see our 200 last time, so we
 *     return 200 immediately without re-running side effects.
 *  2. **Booking-level**: when transitioning to PAID we re-check the
 *     current status under a transaction with `SELECT ... FOR UPDATE`
 *     on the departure row. If the booking is already PAID/REFUNDED we
 *     skip the seat increment; if seats are full, we trigger a refund.
 *
 * Why FOR UPDATE on the departure (not the booking):
 *
 *  Two concurrent bookings paying for the last 2 seats will hit the
 *  webhook close in time. Locking each booking individually doesn't
 *  serialise them — they need to contend for the same `departure` row
 *  to atomically check + bump `seatsBooked`. Postgres serialises any
 *  `SELECT FOR UPDATE` against that row, so the second booking sees
 *  the post-increment count and either fits or refunds.
 *
 * Events handled:
 *
 *  - `checkout.session.completed` → mark PAID, increment seats, persist
 *    `stripePaymentIntentId` (needed for B3.5 refund).
 *  - `checkout.session.expired`   → mark CANCELLED (no seat change).
 *  - everything else              → logged + ignored. Stripe sends many
 *    event types we don't subscribe to; treat them as no-ops rather
 *    than 400s so the dashboard doesn't show false "failed" deliveries.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  /**
   * Entry point — called by the controller with the **raw** request bytes
   * and the `Stripe-Signature` header.
   *
   * Steps:
   *  1. Verify signature (Stripe SDK; throws on tamper).
   *  2. Idempotency insert into `payment_events`; bail out if duplicate.
   *  3. Dispatch on `event.type`.
   *
   * Return value goes into the HTTP response body; Stripe ignores the
   * body and only cares about the status code, but we echo `received:
   * true` for human debuggers + log readers.
   */
  async handleStripeEvent(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: true; eventId: string; type: string }> {
    const webhookSecret = this.config.getOrThrow<string>(
      'stripe.webhookSecret',
    );

    // 1. Verify
    let event: Awaited<ReturnType<StripeService['constructEvent']>>;
    try {
      event = this.stripe.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(`Rejected webhook (signature invalid): ${message}`);
      throw new BadRequestException({
        code: 'STRIPE_WEBHOOK_INVALID',
        message: `Signature verification failed: ${message}`,
      });
    }

    // 2. Idempotency — insert event row first (processedAt stays NULL until
    //    the handler finishes). P2002 means "already saw this id" — but only
    //    a row with a non-null processedAt may be skipped. A NULL one means
    //    a previous attempt crashed between insert and completion, and the
    //    Stripe retry we're handling right now is our chance to recover:
    //    re-run the handler (booking-level idempotency makes that safe).
    try {
      await this.prisma.paymentEvent.create({
        data: {
          stripeEventId: event.id,
          type: event.type,
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (!this.isUniqueConstraintError(err)) throw err;
      const existing = await this.prisma.paymentEvent.findUnique({
        where: { stripeEventId: event.id },
        select: { processedAt: true },
      });
      if (existing?.processedAt) {
        this.logger.log(
          `Skipping duplicate Stripe event ${event.id} (${event.type}) — already processed`,
        );
        return { received: true, eventId: event.id, type: event.type };
      }
      this.logger.warn(
        `Re-processing Stripe event ${event.id} (${event.type}) — prior attempt never finished`,
      );
    }

    // 3. Dispatch
    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event);
        break;
      case 'checkout.session.expired':
        await this.onCheckoutExpired(event);
        break;
      default:
        this.logger.log(`Ignoring unhandled Stripe event type: ${event.type}`);
    }

    // 4. Mark done — from here on, retries of this event id are pure no-ops.
    await this.prisma.paymentEvent.update({
      where: { stripeEventId: event.id },
      data: { processedAt: new Date() },
    });

    return { received: true, eventId: event.id, type: event.type };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Event handlers
  // ────────────────────────────────────────────────────────────────────────

  /**
   * The happy path: Stripe confirms payment.
   *
   * Inside a single transaction with `FOR UPDATE` on the departure:
   *  - Re-read the booking — if already PAID/REFUNDED, no-op (idempotent).
   *  - Re-check capacity. If seats no longer fit (race with another
   *    booking that finished first), trigger an automatic refund + set
   *    the booking to CANCELLED.
   *  - Otherwise: bump `seatsBooked`, flip booking PAID, persist
   *    `paid_at` + `stripe_payment_intent_id`.
   *
   * We DO NOT call Stripe (the refund branch) inside the DB transaction —
   * holding a DB connection open during an outbound HTTP call is the
   * Supavisor anti-pattern flagged in the bookings runbook. Instead, we
   * read the overbook state, commit the transaction with the booking
   * still PENDING, then run the refund + status flip in a second tx.
   */
  private async onCheckoutCompleted(event: WebhookEvent): Promise<void> {
    const session = event.data.object as CheckoutSessionLike;
    const bookingId = session.metadata?.bookingId;
    const bookingCode = session.metadata?.bookingCode ?? '<unknown>';
    if (!bookingId) {
      this.logger.warn(
        `checkout.session.completed ${session.id} missing metadata.bookingId — ignoring`,
      );
      return;
    }
    const paymentIntentId = this.extractPaymentIntentId(session);

    // Return the outcome from inside the transaction so TS can narrow the
    // post-tx switch. Mutating an outer `let` works at runtime but the
    // closure escapes type narrowing, leaving the outer var stuck at its
    // initial literal type.
    type SeatCheckOutcome = 'paid' | 'already_processed' | 'overbooked';

    const outcome: SeatCheckOutcome = await this.prisma.$transaction(
      async (tx): Promise<SeatCheckOutcome> => {
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { departure: true },
        });
        if (!booking) {
          this.logger.warn(
            `Booking ${bookingCode} (${bookingId}) not found — ignoring webhook`,
          );
          return 'already_processed';
        }
        if (booking.status !== BookingStatus.PENDING) {
          this.logger.log(
            `Booking ${bookingCode} already in ${booking.status} state — skipping`,
          );
          return 'already_processed';
        }

        // Lock the departure row, re-read the latest seatsBooked.
        const locked = await tx.$queryRaw<
          { seatsTotal: number; seatsBooked: number }[]
        >`
          SELECT seats_total AS "seatsTotal", seats_booked AS "seatsBooked"
          FROM tour_departures
          WHERE id = ${booking.departureId}::uuid
          FOR UPDATE
        `;
        const row = locked[0];
        if (!row) {
          this.logger.error(
            `Departure ${booking.departureId} disappeared mid-transaction for booking ${bookingCode}`,
          );
          return 'already_processed';
        }

        const totalSeats = booking.numAdults + booking.numChildren;
        const remaining = row.seatsTotal - row.seatsBooked;
        if (remaining < totalSeats) {
          // Race lost — defer the refund to outside the tx.
          return 'overbooked';
        }

        await tx.tourDeparture.update({
          where: { id: booking.departureId },
          data: { seatsBooked: row.seatsBooked + totalSeats },
        });
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.PAID,
            paidAt: new Date(),
            stripePaymentIntentId: paymentIntentId,
          },
        });
        return 'paid';
      },
    );

    if (outcome === 'paid') {
      this.logger.log(
        `Booking ${bookingCode} confirmed PAID (payment_intent=${paymentIntentId ?? 'n/a'})`,
      );
      await this.sendConfirmationEmail(bookingId);
    } else if (outcome === 'overbooked') {
      await this.refundOverbookedAndCancel({
        bookingId,
        bookingCode,
        paymentIntentId,
      });
    }
  }

  /**
   * Stripe didn't see a payment within 30 min — the session expired. Mark
   * the booking CANCELLED. We never reserved seats at PENDING, so there's
   * nothing to release.
   */
  private async onCheckoutExpired(event: WebhookEvent): Promise<void> {
    const session = event.data.object as CheckoutSessionLike;
    const bookingId = session.metadata?.bookingId;
    if (!bookingId) return;

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, code: true, status: true },
    });
    if (!booking || booking.status !== BookingStatus.PENDING) return;

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED, cancelledAt: new Date() },
    });
    this.logger.log(
      `Booking ${booking.code} expired (Stripe session ${session.id}) — marked CANCELLED`,
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Outside the DB transaction so Stripe HTTP latency doesn't hold a
   * pooler connection. Order matters: refund first, THEN flip the row.
   * If Stripe rejects the refund (e.g. dispute window closed), we
   * deliberately leave the booking PENDING — that surfaces as a stale
   * row in the admin dashboard so an operator can intervene.
   */
  private async refundOverbookedAndCancel(args: {
    bookingId: string;
    bookingCode: string;
    paymentIntentId: string | undefined;
  }): Promise<void> {
    if (!args.paymentIntentId) {
      this.logger.error(
        `Cannot auto-refund overbooked booking ${args.bookingCode} — payment_intent missing on session`,
      );
      return;
    }

    try {
      await this.stripe.createRefund({
        paymentIntentId: args.paymentIntentId,
        reason: 'requested_by_customer',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      this.logger.error(
        `Refund failed for overbooked booking ${args.bookingCode}: ${message}`,
      );
      return;
    }

    await this.prisma.booking.update({
      where: { id: args.bookingId },
      data: {
        status: BookingStatus.REFUNDED,
        cancelledAt: new Date(),
        stripePaymentIntentId: args.paymentIntentId,
      },
    });
    this.logger.warn(
      `Auto-refunded overbooked booking ${args.bookingCode} (payment_intent=${args.paymentIntentId})`,
    );
  }

  /**
   * Loads the booking + relations we need to render the confirmation
   * template and hands off to `EmailService`. Failure modes are logged
   * but never thrown — the booking is already PAID and a stuck send
   * shouldn't force Stripe into a retry loop.
   */
  private async sendConfirmationEmail(bookingId: string): Promise<void> {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          user: { select: { locale: true } },
          tour: { select: { titleEn: true, titleVi: true } },
          departure: { select: { startDate: true, endDate: true } },
        },
      });
      if (!booking) return;
      const locale = booking.user?.locale ?? Locale.en;
      const tourTitle =
        locale === Locale.vi ? booking.tour.titleVi : booking.tour.titleEn;
      await this.email.sendBookingConfirmation({
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(
        `Failed to load booking ${bookingId} for confirmation email: ${message}`,
      );
    }
  }

  /**
   * Stripe's `payment_intent` field on a session is either a string id or
   * the expanded object. Normalise to an id (or undefined when absent —
   * which happens for free sessions but never for our paid flow).
   */
  private extractPaymentIntentId(
    session: CheckoutSessionLike,
  ): string | undefined {
    const pi = session.payment_intent;
    if (!pi) return undefined;
    if (typeof pi === 'string') return pi;
    return pi.id;
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Local types — see stripe.service.ts for the SDK quirk explanation.
// We type the webhook event narrowly here so the service file doesn't have
// to import the deep `Stripe.Stripe.Event` path.
// ──────────────────────────────────────────────────────────────────────────

interface WebhookEvent {
  id: string;
  type: string;
  data: { object: unknown };
}

interface CheckoutSessionLike {
  id: string;
  metadata?: { bookingId?: string; bookingCode?: string } | null;
  payment_intent?: string | { id: string } | null;
}
