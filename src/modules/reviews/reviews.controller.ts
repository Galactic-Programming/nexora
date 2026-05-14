import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Review, User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

/**
 * Customer-facing review surface mounted at `/reviews`.
 *
 * Public read of approved reviews lives under the Tours controller
 * (`GET /tours/:slug/reviews` — Sprint B4.2). Admin moderation lives
 * under `/admin/reviews/:id` (Sprint B4.3).
 */
@ApiTags('Reviews')
@ApiBearerAuth('supabase-jwt')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a review for one of caller's PAID bookings",
  })
  @ApiResponse({ status: 201, description: 'Created (pending approval)' })
  @ApiResponse({ status: 400, description: 'Booking not PAID' })
  @ApiResponse({ status: 401, description: 'User not synced' })
  @ApiResponse({ status: 403, description: 'Not the owner of the booking' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 409, description: 'Booking already has a review' })
  create(
    @CurrentUser() user: User | null,
    @Body() body: CreateReviewDto,
  ): Promise<Review> {
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_SYNCED',
        message: 'Run POST /auth/sync before submitting a review',
      });
    }
    return this.reviewsService.createForCustomer(user.id, body);
  }
}
