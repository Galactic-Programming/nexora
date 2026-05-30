import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body for `POST /admin/bookings/:id/refund`.
 *
 * `reason` is free-form because Stripe's enum (`duplicate` / `fraudulent`
 * / `requested_by_customer`) doesn't cover the tour-specific cases the
 * admin needs to track ("tour cancelled", "overbooked", "weather"). We
 * forward to Stripe when the value matches its enum and persist the raw
 * string elsewhere via metadata otherwise (see `StripeService.createRefund`).
 */
export class RefundBookingDto {
  @ApiPropertyOptional({
    description: 'Optional human-readable reason logged with Stripe metadata.',
    example: 'Tour cancelled due to weather',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
