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
 * Optional metadata the FE may send on first sync (after sign-up form).
 * Sub + email always come from the verified JWT, never the body.
 */
export class SyncUserDto {
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

  @ApiPropertyOptional({ enum: Locale, example: Locale.en })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;
}
