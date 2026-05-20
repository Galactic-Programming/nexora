import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Booking, User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BookingsService, CreatedBooking } from './bookings.service';
import { BookingDto, CreateBookingResponseDto } from './dto/booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

/**
 * Customer-facing booking surface mounted at `/bookings`.
 *
 * Auth: every endpoint requires a verified Supabase JWT (collection-level
 * guard handles this). Role check is implicit — admins technically can hit
 * these paths but the data they see is scoped to their own user id, same
 * as customers. Admins manage refunds via a separate `/admin/bookings/*`
 * surface in B3.5.
 *
 * All handlers fail with 401 `USER_NOT_SYNCED` when `@CurrentUser()`
 * resolves to null. That happens when a freshly-signed-up user hits this
 * endpoint before calling `/auth/sync` — the FE should always sync first.
 */
@ApiTags('Bookings')
@ApiBearerAuth('supabase-jwt')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * `POST /bookings` — create a PENDING booking + mint a Stripe Checkout
   * session.
   *
   * Returns 201 with `{ checkoutUrl, bookingCode, bookingId, status }`.
   * The FE redirects to `checkoutUrl` immediately. After payment Stripe
   * fires the webhook (B3.4) which flips the booking to PAID.
   *
   * Errors:
   *  - 401 `USER_NOT_SYNCED` — caller hasn't run `/auth/sync` yet.
   *  - 404 `TOUR_NOT_FOUND` | `DEPARTURE_NOT_FOUND`.
   *  - 400 `DEPARTURE_NOT_OPEN` — departure is CLOSED or CANCELLED.
   *  - 409 `SEATS_NOT_AVAILABLE` — best-effort capacity check failed.
   */
  @Post()
  @ApiOperation({ summary: 'Create a booking + Stripe Checkout session' })
  @ApiCreatedResponse({
    type: CreateBookingResponseDto,
    description: 'Created + checkout URL minted',
  })
  @ApiResponse({ status: 400, description: 'Departure not OPEN' })
  @ApiResponse({ status: 401, description: 'User not synced' })
  @ApiResponse({ status: 404, description: 'Tour or departure not found' })
  @ApiResponse({ status: 409, description: 'No seats available' })
  create(
    @CurrentUser() user: User | null,
    @Body() body: CreateBookingDto,
  ): Promise<CreatedBooking> {
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_SYNCED',
        message: 'Run POST /auth/sync before creating bookings',
      });
    }
    return this.bookingsService.create(user.id, body);
  }

  /**
   * `GET /bookings/me` — the caller's bookings, newest first. Capped at
   * 50 rows; if `/account/bookings` ever needs more it gets pagination.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Caller's bookings (newest first, top 50)" })
  @ApiOkResponse({
    type: [BookingDto],
    description: 'Bookings with tour + departure joined',
  })
  @ApiResponse({ status: 401, description: 'User not synced' })
  listOwn(@CurrentUser() user: User | null): Promise<Booking[]> {
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_SYNCED',
        message: 'Run POST /auth/sync before listing bookings',
      });
    }
    return this.bookingsService.findOwnList(user.id);
  }

  /**
   * `GET /bookings/:code` — owner-or-admin only. Non-owners see 404 (we
   * don't reveal code existence to enumeration attacks).
   *
   * The `:code` path is placed AFTER `:me` to avoid Nest routing
   * collisions — `/bookings/me` and `/bookings/{anything-else}` both
   * resolve cleanly because `me` is a literal segment, but listing
   * the literal route first is the safer reading order.
   */
  @Get(':code')
  @ApiOperation({ summary: 'Get one booking by code (owner or admin)' })
  @ApiOkResponse({ type: BookingDto, description: 'Booking detail' })
  @ApiResponse({ status: 401, description: 'User not synced' })
  @ApiResponse({ status: 404, description: 'Booking not found or not owned' })
  detail(
    @CurrentUser() user: User | null,
    @Param('code') code: string,
  ): Promise<Booking> {
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_SYNCED',
        message: 'Run POST /auth/sync before fetching bookings',
      });
    }
    return this.bookingsService.findByCodeForCaller(code, {
      id: user.id,
      role: user.role,
    });
  }
}
