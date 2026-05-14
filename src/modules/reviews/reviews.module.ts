import { Module } from '@nestjs/common';
import { PublicReviewsController } from './public-reviews.controller';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

/**
 * Reviews module. B4.1 ships `POST /reviews` (customer create). B4.2 will
 * add the public list under the Tours controller; B4.3 adds the admin
 * moderation controller in this same module + exports the service for
 * future stats joins (B4.5).
 */
@Module({
  controllers: [ReviewsController, PublicReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
