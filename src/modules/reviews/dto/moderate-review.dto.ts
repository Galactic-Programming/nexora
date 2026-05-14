import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * Body for `PATCH /admin/reviews/:id`. We model approve/reject as a
 * boolean flag rather than separate endpoints — keeps the surface small
 * and lets the admin toggle a previously-approved review back to draft
 * if it gets flagged later.
 */
export class ModerateReviewDto {
  @ApiProperty({
    description: 'true to approve and publish; false to revert to draft.',
    example: true,
  })
  @IsBoolean()
  isApproved!: boolean;
}
