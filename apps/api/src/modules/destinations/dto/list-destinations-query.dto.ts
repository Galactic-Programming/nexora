import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Query string for `GET /destinations` (public) and the admin variant.
 *
 * All fields are optional. The global `ValidationPipe` is configured with
 * `enableImplicitConversion: true`, so query strings like `?page=2` arrive
 * as numbers without needing manual `parseInt`. The explicit `@Type(() =>
 * Number)` decorators below make this work even when implicit conversion
 * is disabled in tests.
 */
export class ListDestinationsQueryDto {
  /** 1-indexed page number. */
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** Items per page. Capped at 100 to prevent unbounded queries. */
  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  /**
   * Free-text search applied to `name_en` / `name_vi` (case-insensitive).
   * Trimmed before use; empty string is treated as "no filter".
   */
  @ApiPropertyOptional({ example: 'hoi', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  /**
   * Public list endpoint hard-codes `isActive: true` regardless of this
   * field — only the admin endpoint honours it (so admins can see drafts).
   */
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  /**
   * Sort key. Whitelisted to prevent SQL-injection-via-orderBy (Prisma
   * accepts arbitrary strings here and would silently fail or expose
   * internals).
   */
  @ApiPropertyOptional({
    example: 'createdAt',
    enum: ['createdAt', 'updatedAt', 'nameEn', 'nameVi'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'nameEn', 'nameVi'])
  sortBy?: 'createdAt' | 'updatedAt' | 'nameEn' | 'nameVi' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
