import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO mirroring the Prisma `User` model exposed to the FE.
 * Sensitive columns (none currently — Supabase owns passwords) are omitted.
 */
export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Supabase auth.users.id' })
  supabaseId!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  fullName!: string | null;

  @ApiProperty({ nullable: true, type: String })
  phone!: string | null;

  @ApiProperty({ enum: ['en', 'vi'], example: 'en' })
  locale!: 'en' | 'vi';

  @ApiProperty({ enum: ['CUSTOMER', 'ADMIN'], example: 'CUSTOMER' })
  role!: 'CUSTOMER' | 'ADMIN';

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
