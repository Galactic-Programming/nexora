import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * Global so both `PaymentsService` (webhook PAID confirmation) and
 * `BookingsService` (admin refund) can inject it without each feature
 * module re-importing `EmailModule`. Email is a leaf concern with one
 * implementation; the global registration keeps the dep graph flat.
 */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
