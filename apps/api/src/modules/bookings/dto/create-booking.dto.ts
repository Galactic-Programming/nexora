import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Request body for `POST /bookings`.
 *
 * Identification:
 *  - `tourSlug` (kebab-case) is the human-readable handle. The service
 *    resolves it to a tour id.
 *  - `departureId` is a UUID — there's no human-readable handle for
 *    departures since multiple rows can share a start date.
 *
 * Guest fields:
 *  - We always trust the JWT `sub` claim for the booking owner (`userId`),
 *    so user identity is never in the body. But contact details ARE in
 *    the body because the buyer may book on behalf of someone else
 *    (parent paying for child, travel agent for client, ...).
 *
 * Capacity:
 *  - `numAdults >= 1` enforced here. `numChildren` defaults to 0 and is
 *    additive — total seats = `numAdults + numChildren`. We bound both
 *    at 20 each to keep payloads sane; group bookings beyond that should
 *    use the upcoming "request quote" flow (not in scope for v1).
 *
 * Server-controlled fields that DO NOT live in this DTO:
 *  - `userId`            — taken from JWT.
 *  - `totalAmount`       — computed from `tour.basePrice` + departure override.
 *  - `currency`          — taken from `tour.currency`.
 *  - `code`              — generated server-side (`BK-XXXXXXXX`).
 *  - `status`            — always `PENDING` on create.
 *  - `seatsBooked` delta — applied only by the webhook handler in B3.4
 *    after `checkout.session.completed`, under a transaction with row lock.
 */
export class CreateBookingDto {
  @ApiProperty({
    example: 'hoi-an-walking-tour',
    description: 'Slug of an existing published tour (kebab-case).',
  })
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'tourSlug must be kebab-case',
  })
  tourSlug!: string;

  @ApiProperty({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'UUID of a departure under the tour. Must be OPEN.',
  })
  @IsUUID()
  departureId!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  numAdults!: number;

  @ApiPropertyOptional({ example: 1, minimum: 0, maximum: 20, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  numChildren?: number;

  @ApiProperty({ example: 'Nguyen Van A', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  contactName!: string;

  /** Booking confirmation + voucher PDF go to this email. */
  @ApiProperty({ example: 'guest@example.com' })
  @IsEmail()
  @MaxLength(200)
  contactEmail!: string;

  @ApiPropertyOptional({ example: '+84901234567', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  /** Free-form notes shown to the tour operator (dietary, mobility, ...). */
  @ApiPropertyOptional({ example: 'Vegetarian meals for one adult.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;
}
