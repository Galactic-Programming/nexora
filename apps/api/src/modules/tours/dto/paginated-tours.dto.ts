import { ApiProperty } from '@nestjs/swagger';
import { ApiMetaDto } from '../../../common/dto/api-response.dto';
import { TourWithStatsDto } from './tour.dto';

/**
 * Paginated public tours payload. Shape matches `PaginatedTours` from
 * `tours.service.ts`; `TransformInterceptor` hoists `meta` to the envelope
 * top level on serialisation, but the inner controller return type is what
 * Swagger reflects on.
 */
export class PaginatedToursDto {
  @ApiProperty({ type: () => [TourWithStatsDto] })
  items!: TourWithStatsDto[];

  @ApiProperty({ type: () => ApiMetaDto })
  meta!: ApiMetaDto;
}
