import { ApiPropertyOptional } from '@nestjs/swagger';
import { DepartureStatus } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional } from 'class-validator';

/**
 * Query string for `GET /tours/:slug/departures` (public) and the admin
 * equivalent.
 *
 * Defaults differ between the two surfaces (applied in the service):
 *  - Public list defaults to `from = today` and `status = OPEN`. End users
 *    have no reason to browse past or cancelled departures.
 *  - Admin list omits both defaults so operators can see the full history
 *    including CLOSED + CANCELLED rows for audit purposes.
 */
export class ListDeparturesQueryDto {
  /** Inclusive lower bound on `startDate`. ISO 8601 (`YYYY-MM-DD`). */
  @ApiPropertyOptional({ example: '2026-06-01', description: 'ISO 8601 date' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  /** Inclusive upper bound on `startDate`. ISO 8601 (`YYYY-MM-DD`). */
  @ApiPropertyOptional({ example: '2026-12-31', description: 'ISO 8601 date' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional({ enum: DepartureStatus })
  @IsOptional()
  @IsEnum(DepartureStatus)
  status?: DepartureStatus;
}
