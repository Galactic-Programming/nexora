import { ApiProperty } from '@nestjs/swagger';

export class ReviewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tourId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  bookingId!: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  rating!: number;

  @ApiProperty({ nullable: true, type: String })
  title!: string | null;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  isApproved!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/**
 * Public review — includes the reviewer's display name (no email/id leak).
 */
export class PublicReviewDto extends ReviewDto {
  @ApiProperty({
    nullable: true,
    type: String,
    description: "Reviewer's full name (null if not set)",
  })
  userFullName!: string | null;
}
