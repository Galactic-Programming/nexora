import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Booking, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { BookingsService } from './bookings.service';
import { BookingDto } from './dto/booking.dto';
import { RefundBookingDto } from './dto/refund-booking.dto';

/**
 * Admin-only booking surface mounted at `/admin/bookings`.
 *
 * Currently exposes refund only — list/detail for admins go through the
 * customer-facing `/bookings/:code` (the existing handler already widens
 * the auth check to admins).
 *
 * Auth: every endpoint requires a verified Supabase JWT AND
 * `role === ADMIN`. The collection-level `RolesGuard` reads
 * `@Roles(...)` and short-circuits before the handler.
 */
@ApiTags('Admin / Bookings')
@ApiBearerAuth('supabase-jwt')
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * `POST /admin/bookings/:id/refund` — refund a PAID booking via Stripe
   * and release the held seats.
   *
   * Errors:
   *  - 404 `BOOKING_NOT_FOUND` — id doesn't exist.
   *  - 400 `BOOKING_NOT_REFUNDABLE` — status is not PAID, or there's no
   *    `stripePaymentIntentId` to refund against.
   *  - 400 `REFUND_FAILED` — Stripe rejected the refund (dispute window
   *    closed, payment already refunded with a different reason, etc.).
   */
  @Post(':id/refund')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refund a PAID booking (admin)' })
  @ApiOkResponse({
    type: BookingDto,
    description: 'Booking REFUNDED + seats released',
  })
  @ApiResponse({ status: 400, description: 'Not refundable or Stripe failed' })
  @ApiResponse({ status: 401, description: 'Missing/invalid token' })
  @ApiResponse({ status: 403, description: 'Caller is not an admin' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  refund(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RefundBookingDto,
  ): Promise<Booking> {
    return this.bookingsService.refundByAdmin({
      bookingId: id,
      reason: body.reason,
    });
  }
}
