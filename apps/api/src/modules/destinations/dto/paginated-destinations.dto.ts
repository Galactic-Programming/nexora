import { ApiProperty } from '@nestjs/swagger';
import { ApiMetaDto } from '../../../common/dto/api-response.dto';
import { DestinationDto } from './destination.dto';

export class PaginatedDestinationsDto {
  @ApiProperty({ type: () => [DestinationDto] })
  items!: DestinationDto[];

  @ApiProperty({ type: () => ApiMetaDto })
  meta!: ApiMetaDto;
}
