import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Review, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { ReviewDto } from './dto/review.dto';
import { ReviewsService } from './reviews.service';

/**
 * Admin moderation surface mounted at `/admin/reviews`. Approves or
 * re-drafts a single review by id.
 *
 * Auth: requires verified Supabase JWT + `role === ADMIN`. `RolesGuard`
 * enforces `@Roles(ADMIN)` before the handler runs.
 */
@ApiTags('Admin / Reviews')
@ApiBearerAuth('supabase-jwt')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or re-draft a review (admin)' })
  @ApiOkResponse({ type: ReviewDto, description: 'Updated review row' })
  @ApiResponse({ status: 401, description: 'Missing/invalid token' })
  @ApiResponse({ status: 403, description: 'Caller is not an admin' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  moderate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ModerateReviewDto,
  ): Promise<Review> {
    return this.reviewsService.moderateById(id, body.isApproved);
  }
}
