import { ApiProperty } from '@nestjs/swagger';

const DEPARTURE_STATUSES = ['OPEN', 'CLOSED', 'CANCELLED'] as const;
type DepartureStatus = (typeof DEPARTURE_STATUSES)[number];

export class DepartureDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tourId!: string;

  @ApiProperty({ format: 'date', example: '2026-09-12' })
  startDate!: string;

  @ApiProperty({ format: 'date', example: '2026-09-15' })
  endDate!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '249.00',
    description: 'Decimal serialised as string; null = use tour basePrice',
  })
  priceOverride!: string | null;

  @ApiProperty({ example: 20 })
  seatsTotal!: number;

  @ApiProperty({ example: 7 })
  seatsBooked!: number;

  @ApiProperty({ enum: DEPARTURE_STATUSES, example: 'OPEN' })
  status!: DepartureStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
