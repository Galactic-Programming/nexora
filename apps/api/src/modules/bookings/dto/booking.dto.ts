import { ApiProperty } from '@nestjs/swagger';

const BOOKING_STATUSES = ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'] as const;
type BookingStatus = (typeof BOOKING_STATUSES)[number];

const DEPARTURE_STATUSES = ['OPEN', 'CLOSED', 'CANCELLED'] as const;
type DepartureStatus = (typeof DEPARTURE_STATUSES)[number];

/**
 * Tour fields joined onto a booking row. Both `GET /bookings/me` and
 * `GET /bookings/:code` already `include` exactly these columns
 * (`bookings.service.ts findOwnList` / `findByCodeForCaller`); this class only
 * documents that shape for Swagger so the generated FE client is typed.
 */
export class BookingTourSummaryDto {
  @ApiProperty({ example: 'sa-pa-trek-2d1n' })
  slug!: string;

  @ApiProperty({ example: 'Sapa Rice Terrace Trek (2D1N Homestay)' })
  titleEn!: string;

  @ApiProperty({ example: 'Trekking ruộng bậc thang Sa Pa (2N1Đ homestay)' })
  titleVi!: string;
}

/**
 * Departure fields joined onto a booking row. `status` is only selected by
 * `findByCodeForCaller` (detail) — `findOwnList` (list) omits it — so it is
 * documented as optional.
 */
export class BookingDepartureSummaryDto {
  @ApiProperty({ format: 'date', example: '2026-09-12' })
  startDate!: string;

  @ApiProperty({ format: 'date', example: '2026-09-15' })
  endDate!: string;

  @ApiProperty({
    required: false,
    enum: DEPARTURE_STATUSES,
    example: 'OPEN',
    description: 'Present on GET /bookings/:code; omitted on GET /bookings/me',
  })
  status?: DepartureStatus;
}

export class BookingDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'BK-7K3F92' })
  code!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  tourId!: string;

  @ApiProperty({ format: 'uuid' })
  departureId!: string;

  @ApiProperty({ example: 2 })
  numAdults!: number;

  @ApiProperty({ example: 1 })
  numChildren!: number;

  @ApiProperty({
    type: String,
    example: '597.00',
    description: 'Decimal serialised as string',
  })
  totalAmount!: string;

  @ApiProperty({ example: 'USD', maxLength: 3 })
  currency!: string;

  @ApiProperty({ enum: BOOKING_STATUSES, example: 'PENDING' })
  status!: BookingStatus;

  @ApiProperty()
  contactName!: string;

  @ApiProperty({ format: 'email' })
  contactEmail!: string;

  @ApiProperty({ nullable: true, type: String })
  contactPhone!: string | null;

  @ApiProperty({ nullable: true, type: String })
  specialRequests!: string | null;

  @ApiProperty({ nullable: true, type: String })
  stripeSessionId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  stripePaymentIntentId!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  paidAt!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  cancelledAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: BookingTourSummaryDto })
  tour!: BookingTourSummaryDto;

  @ApiProperty({ type: BookingDepartureSummaryDto })
  departure!: BookingDepartureSummaryDto;
}

/**
 * Response from `POST /bookings` — Stripe Checkout session created.
 */
export class CreateBookingResponseDto {
  @ApiProperty({ example: 'BK-7K3F92' })
  bookingCode!: string;

  @ApiProperty({
    format: 'uri',
    example: 'https://checkout.stripe.com/c/pay/cs_test_xxx',
    description: 'Redirect the browser here to complete payment',
  })
  checkoutUrl!: string;
}
