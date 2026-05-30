import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Body for `POST /reviews`.
 *
 * `bookingCode` is the customer-facing identifier (BK-XXXXXXXX), not the
 * UUID — that's what the FE has from the success page + `/bookings/me`
 * list, so we accept it directly to spare the FE an extra lookup.
 */
export class CreateReviewDto {
  @ApiProperty({
    description: 'Booking code that this review is attached to (must be PAID).',
    example: 'BK-ABCDEFGH',
    pattern: '^BK-[A-Z0-9]{6,12}$',
  })
  @IsString()
  @Matches(/^BK-[A-Z0-9]{6,12}$/, {
    message: 'bookingCode must look like BK-XXXXXXXX (uppercase base36)',
  })
  bookingCode!: string;

  @ApiProperty({ description: '1–5 stars', minimum: 1, maximum: 5, example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ maxLength: 120, example: 'Unforgettable trip' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiProperty({
    description: 'Review body — 10 to 2000 chars.',
    minLength: 10,
    maxLength: 2000,
    example: 'Guide was excellent and the itinerary was well paced...',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  body!: string;
}
