import { ApiProperty } from '@nestjs/swagger';
import { TourWithStatsDto } from '../../tours/dto/tour.dto';

export class WishlistItemDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  tourId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({
    type: () => TourWithStatsDto,
    description: 'Joined tour payload (includes Figma stats)',
  })
  tour!: TourWithStatsDto;
}
