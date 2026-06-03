import { ApiProperty } from '@nestjs/swagger';
import { DestinationDto } from '../../destinations/dto/destination.dto';
import { MediaItemDto } from '../../media/dto/media.dto';
import { ItineraryDayDto } from './itinerary-day.dto';

const TOUR_CATEGORIES = [
  'DAY',
  'PACKAGE',
  'CUSTOM',
  'HONEYMOON',
  'MUSICAL',
] as const;
type TourCategory = (typeof TOUR_CATEGORIES)[number];

/**
 * Bare Tour row (no relations / no aggregates). Used for admin CRUD responses.
 */
export class TourDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'phu-quoc-sunset-cruise' })
  slug!: string;

  @ApiProperty()
  titleEn!: string;

  @ApiProperty()
  titleVi!: string;

  @ApiProperty({ nullable: true, type: String })
  summaryEn!: string | null;

  @ApiProperty({ nullable: true, type: String })
  summaryVi!: string | null;

  @ApiProperty({ format: 'uuid' })
  destinationId!: string;

  @ApiProperty({ example: 3 })
  durationDays!: number;

  @ApiProperty({ example: 20 })
  maxGroupSize!: number;

  @ApiProperty({
    type: String,
    example: '199.00',
    description: 'Decimal serialised as string',
  })
  basePrice!: string;

  @ApiProperty({ example: 'USD', maxLength: 3 })
  currency!: string;

  @ApiProperty({ enum: TOUR_CATEGORIES, example: 'PACKAGE' })
  category!: TourCategory;

  @ApiProperty({ nullable: true, type: String })
  difficulty!: string | null;

  @ApiProperty()
  isPublished!: boolean;

  @ApiProperty()
  isFeatured!: boolean;

  @ApiProperty({ nullable: true, type: String, format: 'uri' })
  heroImage!: string | null;

  @ApiProperty({ type: [String], example: ['https://cdn/img-1.jpg'] })
  gallery!: string[];

  @ApiProperty({ type: [String], example: ['Hotel', 'Breakfast'] })
  included!: string[];

  @ApiProperty({ type: [String], example: ['Flights', 'Tips'] })
  excluded!: string[];

  @ApiProperty({ nullable: true, type: String })
  meetingPoint!: string | null;

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

/**
 * Tour + Figma-aligned aggregates (B4.6). Used on every public-facing
 * Tour payload, list AND detail.
 */
export class TourWithStatsDto extends TourDto {
  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Mean of approved-only review ratings; null when none',
    example: 4.6,
  })
  averageRating!: number | null;

  @ApiProperty({ example: 18, description: 'Count of approved reviews' })
  reviewsCount!: number;

  @ApiProperty({
    example: 124,
    description: 'Total seatsBooked across the tour departures',
  })
  peopleGoing!: number;
}

/**
 * Public tour detail = TourWithStats + destination + itinerary.
 */
export class TourDetailDto extends TourWithStatsDto {
  @ApiProperty({ type: () => DestinationDto })
  destination!: DestinationDto;

  @ApiProperty({ type: () => [ItineraryDayDto] })
  itinerary!: ItineraryDayDto[];
}
