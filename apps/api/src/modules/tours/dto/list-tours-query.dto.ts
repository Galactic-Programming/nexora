import { ApiPropertyOptional } from '@nestjs/swagger';
import { TourCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Query string for `GET /tours` (public catalog browse).
 *
 * Filters are intentionally optional and AND-combined — sending no params
 * returns the full published catalog. `destination` is matched by slug
 * (not UUID) so URLs from the marketing FE stay human-readable, e.g.
 * `/tours?destination=hoi-an&minPrice=30`.
 *
 * The public list endpoint hard-codes `isPublished: true`; drafts never
 * leak here. Admins use the existing `/admin/tours` surface instead.
 */
export class ListToursQueryDto {
  // ── Pagination ────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  // ── Filters ───────────────────────────────────────────────────────────────

  /**
   * Filter by destination slug. We resolve slug → id in the service layer
   * so callers never have to know UUIDs.
   */
  @ApiPropertyOptional({
    example: 'hoi-an',
    description: 'Destination slug (kebab-case)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'destination must be a kebab-case slug',
  })
  destination?: string;

  @ApiPropertyOptional({ enum: TourCategory })
  @IsOptional()
  @IsEnum(TourCategory)
  category?: TourCategory;

  /** Inclusive lower bound on `basePrice`. Same currency as the row. */
  @ApiPropertyOptional({ example: 30, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minPrice?: number;

  /** Inclusive upper bound on `basePrice`. */
  @ApiPropertyOptional({ example: 200, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxPrice?: number;

  /** Exact match on `durationDays`. Common UX is a day-picker chip row. */
  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  duration?: number;

  /** Featured-only filter for the home-page hero shelf. */
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  featured?: boolean;

  /**
   * Free-text search applied to bilingual title + summary fields
   * (case-insensitive). Trimmed; empty string means "no filter".
   */
  @ApiPropertyOptional({ example: 'lantern', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  // ── Sort ──────────────────────────────────────────────────────────────────

  /**
   * Whitelisted sort columns. Prisma accepts arbitrary strings here so we
   * must validate explicitly — anything else risks runtime errors or
   * leaking schema details.
   */
  @ApiPropertyOptional({
    enum: ['createdAt', 'basePrice', 'durationDays', 'titleEn'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'basePrice', 'durationDays', 'titleEn'])
  sortBy?: 'createdAt' | 'basePrice' | 'durationDays' | 'titleEn' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
