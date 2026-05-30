import { ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

/**
 * Optional profile fields the frontend may send on the first `/auth/sync`
 * call (right after sign-up).
 *
 * Trust model — IMPORTANT:
 * - The user's identity (`sub`, `email`) is taken from the verified JWT
 *   only. Anything in this body is treated as profile metadata, never as
 *   identity.
 * - That's why this DTO doesn't include `email` or `id` fields: even if a
 *   client sent them, the service would ignore them.
 *
 * All fields are optional so re-syncing on every login is cheap (no body
 * needed). The validator constraints below mirror the column constraints
 * in `prisma/schema.prisma` so we fail fast at the boundary.
 */
export class SyncUserDto {
  /**
   * Display name. Trimmed and stored as-is. Empty/blank → null in the DB.
   */
  @ApiPropertyOptional({ example: 'Nguyen Van A', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  /**
   * Contact phone in E.164 or local format. Length 6–20 covers
   * international formats; we don't validate region-specific patterns
   * (TODO: revisit if support tickets show garbage data).
   */
  @ApiPropertyOptional({ example: '+84901234567', maxLength: 20 })
  @IsOptional()
  @IsString()
  @Length(6, 20)
  phone?: string;

  /**
   * Preferred UI locale. Drives transactional email language and any
   * future translated content. Defaults to `en` server-side if omitted.
   */
  @ApiPropertyOptional({ enum: Locale, example: Locale.en })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;
}
