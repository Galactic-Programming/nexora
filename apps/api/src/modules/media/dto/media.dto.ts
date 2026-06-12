import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaRole, MediaType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * One media item as sent by the FE inside a resource's `media[]` payload
 * (e.g. on `POST`/`PATCH /admin/tours/:slug`). Pure DATA — never carries an
 * upload signature or secret.
 *
 * The FE obtains `publicId` (+ dimensions / duration) from the Cloudinary
 * upload response after completing a signed upload, then sends the full
 * desired media set for the owner here. `MediaService.syncAssets` treats the
 * array as the complete set (replace-all semantics per owner).
 */
export class MediaInputDto {
  @ApiProperty({
    example: 'tourism/tours/hero/1717000000000-hoi-an',
    description: 'Cloudinary public_id (no extension).',
    maxLength: 300,
  })
  @IsString()
  @MaxLength(300)
  publicId!: string;

  @ApiProperty({ enum: MediaType, example: MediaType.IMAGE })
  @IsEnum(MediaType)
  type!: MediaType;

  /**
   * Closed enum (was a free-form kebab string). Security-first: the FE
   * filters on these exact values and a typo'd role would silently hide
   * media. Adding a slot means extending `MediaRole` in the Prisma schema.
   */
  @ApiProperty({ enum: MediaRole, example: MediaRole.gallery })
  @IsEnum(MediaRole)
  role!: MediaRole;

  @ApiPropertyOptional({ example: 'jpg', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  format?: string;

  @ApiPropertyOptional({ example: 1920, minimum: 1, maximum: 100000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  width?: number;

  @ApiPropertyOptional({ example: 1080, minimum: 1, maximum: 100000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  height?: number;

  @ApiPropertyOptional({
    example: 12.5,
    description: 'Video duration in seconds (video only).',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  durationSec?: number;

  @ApiPropertyOptional({
    example: 'tourism/tours/video/1717000000000-poster',
    description: 'Dedicated poster image public_id (video only).',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  posterId?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Display order.',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/**
 * One media item as returned on a resource read. Delivery URLs are built from
 * `publicId` at read time, so transforms can change without a data migration.
 */
export class MediaItemDto {
  @ApiProperty({ format: 'uri' })
  url!: string;

  @ApiProperty({ enum: MediaType })
  type!: MediaType;

  @ApiProperty({ enum: MediaRole, example: MediaRole.gallery })
  role!: MediaRole;

  @ApiPropertyOptional({ format: 'uri', description: 'Video poster URL.' })
  posterUrl?: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  width?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  height?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  durationSec?: number | null;

  @ApiProperty({ example: 0 })
  sortOrder!: number;
}
