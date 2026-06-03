import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TourCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MediaInputDto } from '../../media/dto/media.dto';

/**
 * Request body for `POST /admin/tours`.
 *
 * Field grouping:
 *  - Identity        — slug, titleEn/Vi, summaryEn/Vi, destinationId
 *  - Logistics       — durationDays, maxGroupSize, meetingPoint
 *  - Pricing         — basePrice, currency
 *  - Classification  — category, difficulty, isPublished, isFeatured
 *  - Media + content — heroImage, gallery, included[], excluded[]
 *
 * Bilingual rule: `titleEn` + `titleVi` are both required (no half-translated
 * tours). `summary*` is optional in BOTH languages — set neither, or both.
 *
 * Itinerary days are managed separately at `/admin/tours/:slug/itinerary`
 * (Sprint B2.4) so this DTO doesn't carry a nested array.
 */
export class CreateTourDto {
  // ── Identity ──────────────────────────────────────────────────────────────

  @ApiProperty({
    example: 'hoi-an-walking-tour',
    minLength: 2,
    maxLength: 120,
    description: 'kebab-case slug; must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be kebab-case (lowercase a-z, digits, single hyphens)',
  })
  slug!: string;

  @ApiProperty({ example: 'Hoi An Ancient Town Walking Tour' })
  @IsString()
  @Length(1, 200)
  titleEn!: string;

  @ApiProperty({ example: 'Tour bộ phố cổ Hội An' })
  @IsString()
  @Length(1, 200)
  titleVi!: string;

  @ApiPropertyOptional({
    example: 'Half-day stroll through lantern-lit alleys.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summaryEn?: string;

  @ApiPropertyOptional({ example: 'Tour nửa ngày qua các con hẻm đèn lồng.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summaryVi?: string;

  @ApiProperty({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'UUID of an existing destination',
  })
  @IsUUID()
  destinationId!: string;

  // ── Logistics ─────────────────────────────────────────────────────────────

  @ApiProperty({ example: 1, minimum: 1, maximum: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  durationDays!: number;

  @ApiPropertyOptional({
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxGroupSize?: number;

  @ApiPropertyOptional({
    example: 'Hoi An tourist info centre, 78 Le Loi street',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  meetingPoint?: string;

  // ── Pricing ───────────────────────────────────────────────────────────────

  /**
   * Decimal stored at 12,2 precision in Postgres. We accept JSON numbers
   * from the request and let Prisma coerce; values larger than 9999999999.99
   * will be rejected by the DB.
   */
  @ApiProperty({ example: 49.5, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePrice!: number;

  /**
   * Stripe-compatible 3-letter ISO code, lowercase or uppercase accepted.
   * Defaults to `USD` server-side.
   */
  @ApiPropertyOptional({ example: 'USD', minLength: 3, maxLength: 3 })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Za-z]{3}$/, {
    message: 'currency must be a 3-letter ISO code',
  })
  currency?: string;

  // ── Classification ────────────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: TourCategory, default: TourCategory.DAY })
  @IsOptional()
  @IsEnum(TourCategory)
  category?: TourCategory;

  @ApiPropertyOptional({ example: 'easy', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  difficulty?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  // ── Media + content ───────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'tours/hoi-an/hero.jpg', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  heroImage?: string;

  /**
   * Storage paths (or absolute URLs). Capped at 20 to keep payloads sane.
   */
  @ApiPropertyOptional({
    type: [String],
    example: ['tours/hoi-an/g1.jpg', 'tours/hoi-an/g2.jpg'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  gallery?: string[];

  /**
   * Free-form bullet points (e.g. "Local guide", "Lunch", "Insurance").
   * Stored as JSON in Postgres so we don't need a side table; capped at
   * 30 entries to prevent abuse.
   */
  @ApiPropertyOptional({
    type: [String],
    example: ['Local guide', 'Bottled water', 'Lunch'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  included?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['Personal expenses', 'Tips'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  excluded?: string[];

  /**
   * Full desired media set (Cloudinary). Replace-all semantics: whatever the
   * FE sends here becomes the tour's complete media set. Persisted to the
   * `media_assets` table via `MediaService` (legacy `heroImage`/`gallery`
   * remain until Phase 4). Capped at 30 items.
   */
  @ApiPropertyOptional({ type: [MediaInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => MediaInputDto)
  media?: MediaInputDto[];
}
