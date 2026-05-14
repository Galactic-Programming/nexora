import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import { PaginatedPublicReviews, ReviewsService } from './reviews.service';

/**
 * Public read surface for approved reviews on one tour. Mounted at
 * `/tours/:slug/reviews` so the marketing FE can fetch it alongside the
 * tour detail with the same slug it already has.
 *
 * Service-layer strips PII; we expose only the reviewer display name +
 * the review content + rating. Drafts (`isApproved=false`) never appear.
 */
@ApiTags('Reviews (Public)')
@Controller('tours/:slug/reviews')
export class PublicReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List approved reviews for a tour (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated approved reviews' })
  @ApiResponse({
    status: 404,
    description: 'Tour slug not found or unpublished',
  })
  list(
    @Param('slug') slug: string,
    @Query() query: ListReviewsQueryDto,
  ): Promise<PaginatedPublicReviews> {
    return this.reviewsService.findApprovedForTour(slug, query);
  }
}
