import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';

/**
 * Bundles the Stripe wrapper so other modules can inject it without
 * touching the SDK directly. Exports `StripeService` so:
 *
 *  - `BookingsModule` uses it to mint Checkout sessions (B3.1).
 *  - The webhook controller (added in B3.4) will live in this module.
 *  - Admin refund (B3.5) will route through here.
 */
@Module({
  providers: [StripeService],
  exports: [StripeService],
})
export class PaymentsModule {}
