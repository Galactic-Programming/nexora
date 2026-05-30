import { ApiProperty } from '@nestjs/swagger';

export class ItineraryDayDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tourId!: string;

  @ApiProperty({ example: 1 })
  dayNumber!: number;

  @ApiProperty()
  titleEn!: string;

  @ApiProperty()
  titleVi!: string;

  @ApiProperty({ nullable: true, type: String })
  descriptionEn!: string | null;

  @ApiProperty({ nullable: true, type: String })
  descriptionVi!: string | null;
}
