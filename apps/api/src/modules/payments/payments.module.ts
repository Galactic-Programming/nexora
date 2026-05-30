import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

/**
 * Hosts the Stripe wrapper plus the webhook receiver.
 *
 * Exports `StripeService` so:
 *  - `BookingsModule` uses it to mint Checkout sessions (B3.1).
 *  - Admin refund (B3.5) will route through here.
 *
 * `PaymentsService` is module-private — only the webhook controller
 * uses it. If admin-driven booking transitions (refund, manual cancel)
 * ever need shared logic, expose it then.
 */
@Module({
  controllers: [PaymentsController],
  providers: [StripeService, PaymentsService],
  exports: [StripeService],
})
export class PaymentsModule {}
