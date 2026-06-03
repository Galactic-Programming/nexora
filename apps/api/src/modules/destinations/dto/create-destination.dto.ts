import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MediaInputDto } from '../../media/dto/media.dto';

/**
 * Request body for `POST /admin/destinations`.
 *
 * `slug` is the human-readable URL fragment (`/destinations/hoi-an`). We
 * enforce a strict `kebab-case` pattern at the boundary so admins can't
 * accidentally introduce slugs that break URL routing.
 *
 * Bilingual fields (`*_en` / `*_vi`) are required — every Destination must
 * exist in both languages on day one. This avoids a half-translated catalog.
 *
 * Optional editorial fields (`region`, `heroImage`, `description*`) can be
 * added in a follow-up `PATCH`.
 */
export class CreateDestinationDto {
  @ApiProperty({
    example: 'hoi-an',
    minLength: 2,
    maxLength: 80,
    description: 'kebab-case slug; must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'slug must be kebab-case (lowercase a-z, digits, single hyphens, no leading/trailing hyphen)',
  })
  slug!: string;

  @ApiProperty({ example: 'Hoi An', minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  nameEn!: string;

  @ApiProperty({ example: 'Hội An', minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  nameVi!: string;

  /**
   * 2-letter ISO country code OR English country name. We accept the loose
   * format because Vietnam-only catalog is the v1 plan — strict ISO can come
   * later when we add international destinations.
   */
  @ApiPropertyOptional({ example: 'Vietnam', maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;

  @ApiPropertyOptional({ example: 'Central Vietnam', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  region?: string;

  /**
   * Storage path or absolute URL. The signed-URL upload flow (Sprint B2.6)
   * will return a path that admins paste here.
   */
  @ApiPropertyOptional({
    example: 'destinations/hoi-an/hero.jpg',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  heroImage?: string;

  @ApiPropertyOptional({ example: 'Ancient port town in Central Vietnam.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionEn?: string;

  @ApiPropertyOptional({ example: 'Phố cổ ven sông ở miền Trung Việt Nam.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionVi?: string;

  /**
   * Defaults to `true` server-side. Set `false` to create a draft that
   * doesn't appear in public listings until later toggled on.
   */
  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Full desired media set (Cloudinary). Replace-all semantics, persisted to
   * `media_assets` via `MediaService` (legacy `heroImage` remains until
   * Phase 4). Capped at 10 items — destinations are lighter than tours.
   */
  @ApiPropertyOptional({ type: [MediaInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MediaInputDto)
  media?: MediaInputDto[];
}
