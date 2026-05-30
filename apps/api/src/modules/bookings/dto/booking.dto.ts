import { ApiProperty } from '@nestjs/swagger';

const BOOKING_STATUSES = ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'] as const;
type BookingStatus = (typeof BOOKING_STATUSES)[number];

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
