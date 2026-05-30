import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Request body for `POST /admin/tours/:slug/itinerary`.
 *
 * `tourId` is NOT in the body — it's derived from the URL `:slug`. The
 * service resolves slug → tour.id and connects via Prisma `connect`.
 *
 * Bilingual rule (mirrors the Tour DTO): both `titleEn` + `titleVi` are
 * required; descriptions are optional in BOTH languages — set neither,
 * or set both. A half-translated description tends to leak to the wrong
 * locale on the FE.
 *
 * `dayNumber` is unique per tour (DB-enforced) — duplicates get translated
 * to `409 ITINERARY_DAY_EXISTS` by the service layer.
 */
export class CreateItineraryDayDto {
  /**
   * 1-indexed position in the itinerary. Max 60 mirrors the cap on
   * `tour.durationDays` — a 60-day tour can have at most 60 days. We do
   * not validate `dayNumber <= tour.durationDays` here because admins
   * sometimes draft "Day 7" before bumping the tour's duration; let the
   * Tour DTO enforce overall length and keep this DTO independent.
   */
  @ApiProperty({ example: 1, minimum: 1, maximum: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  dayNumber!: number;

  @ApiProperty({ example: 'Arrival & Old Town Walk' })
  @IsString()
  @Length(1, 200)
  titleEn!: string;

  @ApiProperty({ example: 'Đón khách & Tham quan phố cổ' })
  @IsString()
  @Length(1, 200)
  titleVi!: string;

  @ApiPropertyOptional({
    example: 'Pick up at hotel, evening stroll through lantern-lit streets.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionEn?: string;

  @ApiPropertyOptional({
    example: 'Đón tại khách sạn, tản bộ buổi tối qua các con phố đèn lồng.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionVi?: string;
}
