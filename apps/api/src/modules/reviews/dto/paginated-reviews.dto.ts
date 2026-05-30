import { ApiProperty } from '@nestjs/swagger';
import { ApiMetaDto } from '../../../common/dto/api-response.dto';
import { PublicReviewDto } from './review.dto';

export class PaginatedPublicReviewsDto {
  @ApiProperty({ type: () => [PublicReviewDto] })
  items!: PublicReviewDto[];

  @ApiProperty({ type: () => ApiMetaDto })
  meta!: ApiMetaDto;
}
