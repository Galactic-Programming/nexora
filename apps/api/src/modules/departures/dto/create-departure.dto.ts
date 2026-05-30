import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DepartureStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/**
 * Request body for `POST /admin/tours/:slug/departures`.
 *
 * `tourId` is NOT in the body — derived from URL `:slug`. The service
 * resolves slug → tour.id then connects via Prisma.
 *
 * Date format: strict ISO 8601 dates (`YYYY-MM-DD`). The DB column is
 * `@db.Date` (no time component), so passing a full datetime works too
 * but the time portion is discarded. We accept ISO 8601 (which includes
 * `YYYY-MM-DD`) to keep clients flexible.
 *
 * Cross-field rule `endDate >= startDate` is enforced in the service
 * layer rather than via a custom decorator — simpler, single source of
 * truth, easy to unit-test.
 *
 * `seatsBooked` is NEVER accepted from clients — it's managed by the
 * booking flow (Sprint B3). Admins can only set `seatsTotal` (capacity).
 */
export class CreateDepartureDto {
  @ApiProperty({ example: '2026-08-15', description: 'ISO 8601 date' })
  @IsISO8601({ strict: true })
  startDate!: string;

  @ApiProperty({ example: '2026-08-15', description: 'ISO 8601 date' })
  @IsISO8601({ strict: true })
  endDate!: string;

  /** Total capacity. Lower bound 1, upper bound 1000 to prevent abuse. */
  @ApiProperty({ example: 15, minimum: 1, maximum: 1000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  seatsTotal!: number;

  /**
   * Optional override on the tour's `basePrice`. When null/omitted, the
   * tour's base price applies. Same Decimal(12,2) precision as `basePrice`.
   */
  @ApiPropertyOptional({ example: 59.0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceOverride?: number;

  @ApiPropertyOptional({ enum: DepartureStatus, default: DepartureStatus.OPEN })
  @IsOptional()
  @IsEnum(DepartureStatus)
  status?: DepartureStatus;
}
