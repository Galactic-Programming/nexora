import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { AdminBookingsController } from './admin-bookings.controller';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

/**
 * Customer-facing booking surface. Pulls `StripeService` from
 * `PaymentsModule` to mint Checkout sessions; reads/writes the `bookings`
 * table directly via Prisma.
 *
 * `BookingsService` is exported so the webhook controller (B3.4 in
 * `PaymentsModule`) can mark bookings PAID/CANCELLED without a circular
 * dependency.
 */
@Module({
  imports: [PaymentsModule],
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
