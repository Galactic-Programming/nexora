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
 * Request body for `PATCH /users/me`.
 *
 * Only profile fields a user is allowed to change about themselves are
 * listed here. Crucially absent:
 *  - `email` — managed by Supabase Auth; changing it is a separate
 *    re-verification flow.
 *  - `role` — only admins (via dedicated admin endpoints) can change roles.
 *  - `id` / `supabaseId` — immutable identity keys.
 *
 * The DTO mirrors `SyncUserDto` shape but lives in a separate file so the
 * two endpoints can evolve independently (e.g. future "preferred_currency"
 * field that only makes sense post-signup).
 */
export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Nguyen Van A', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ example: '+84901234567', maxLength: 20 })
  @IsOptional()
  @IsString()
  @Length(6, 20)
  phone?: string;

  @ApiPropertyOptional({ enum: Locale })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;
}
