import { ApiProperty } from '@nestjs/swagger';
import { MediaItemDto } from '../../media/dto/media.dto';

export class DestinationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ha-long-bay' })
  slug!: string;

  @ApiProperty({ example: 'Ha Long Bay' })
  nameEn!: string;

  @ApiProperty({ example: 'Vịnh Hạ Long' })
  nameVi!: string;

  @ApiProperty({ example: 'Vietnam' })
  country!: string;

  @ApiProperty({ nullable: true, type: String })
  region!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'uri' })
  heroImage!: string | null;

  @ApiProperty({ nullable: true, type: String })
  descriptionEn!: string | null;

  @ApiProperty({ nullable: true, type: String })
  descriptionVi!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({
    type: () => [MediaItemDto],
    description: 'Cloudinary-backed media (hero/gallery/video).',
  })
  media!: MediaItemDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
