import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Stripe v22 SDK type-namespace note: the default export is a callable
 * constructor wrapped in a namespace, and the rich resource types live
 * one level deeper under `Stripe.Stripe.*` (e.g. `Stripe.Stripe.Checkout.Session`).
 * Most call sites won't need them — we use `await stripe.checkout.sessions.create(...)`
 * and let TS infer the return type. Only annotate explicitly when crossing
 * an export boundary where inference can't reach.
 */

/**
 * Thin wrapper around the Stripe SDK so the rest of the codebase never
 * touches the raw `Stripe` constructor directly. Centralising it here:
 *
 *  - Keeps API version + secret-key wiring in one place.
 *  - Makes the SDK trivially mockable in unit tests (services depend on
 *    `StripeService`, not on `Stripe` itself).
 *  - Avoids construction at import time — `OnModuleInit` runs after the
 *    config namespace is validated, so tests that don't load `StripeModule`
 *    never side-effect on the env.
 *
 * Webhook signature verification (Sprint B3.4) and refunds (B3.5) will
 * land here as additional methods. For B3.1+B3.3 we only need the
 * Checkout Session minter.
 */
@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private stripe!: Stripe.Stripe;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const secretKey = this.config.getOrThrow<string>('stripe.secretKey');
    // No `apiVersion` override: the installed SDK pins its own default,
    // which is sufficient for a thesis project. Lock to a specific version
    // when shipping to prod so the schema doesn't drift.
    this.stripe = new Stripe(secretKey, { typescript: true });
  }

  /**
   * Exposes the raw client for advanced callers (the webhook controller
   * needs `constructEvent` for signature verification). Prefer the
   * named methods on this service when one exists.
   */
  get client(): Stripe.Stripe {
    return this.stripe;
  }

  /**
   * Creates a hosted Checkout Session for a booking.
   *
   * Why hosted Checkout (vs. PaymentIntents + custom card form):
   *  - Zero PCI scope for our backend — Stripe collects card data.
   *  - Built-in support for 3DS, wallets (Apple/Google Pay), and i18n.
   *  - One-line success/cancel redirects fit our SPA flow.
   *
   * Metadata payload is the authoritative bridge between Stripe events
   * and our DB. We pin `bookingId` + `bookingCode` here so the webhook
   * can look up the booking even if the session row is replayed weeks
   * later.
   *
   * @returns The full `Session` so callers get both `id` and `url`.
   */
  async createCheckoutSession(args: {
    bookingId: string;
    bookingCode: string;
    customerEmail: string;
    currency: string;
    unitAmount: number; // already in the smallest currency unit (cents)
    quantity: number;
    productName: string;
    productDescription?: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: args.customerEmail,
      line_items: [
        {
          quantity: args.quantity,
          price_data: {
            currency: args.currency,
            unit_amount: args.unitAmount,
            product_data: {
              name: args.productName,
              description: args.productDescription,
            },
          },
        },
      ],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      // Metadata is the only field that survives across the
      // checkout.session.completed → payment_intent boundary, so anything
      // the webhook needs to identify the booking goes here.
      metadata: {
        bookingId: args.bookingId,
        bookingCode: args.bookingCode,
      },
      // 30-min default expiry on hosted Checkout — explicit so we can
      // reason about abandoned bookings (B3.4 cleanup hook).
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    this.logger.log(
      `Created Stripe Checkout session ${session.id} for booking ${args.bookingCode}`,
    );
    return session;
  }
}
