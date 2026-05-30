import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Tour, User, Wishlist } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WishlistItemDto } from './dto/wishlist.dto';
import { WishlistService } from './wishlist.service';

/**
 * Customer wishlist surface mounted at `/wishlist`.
 *
 * Auth: every endpoint requires a verified Supabase JWT. Caller's userId
 * is the implicit scope — there's no cross-user access for customers,
 * and admins would query the table directly via Supabase Studio for now.
 */
@ApiTags('Wishlist')
@ApiBearerAuth('supabase-jwt')
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  /**
   * `POST /wishlist/:tourId` — idempotent add. Re-posting the same tour
   * for the same user is a no-op and returns 200 (not 409).
   */
  @Post(':tourId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Add a tour to caller's wishlist (idempotent)" })
  @ApiOkResponse({
    type: WishlistItemDto,
    description: 'Wishlist row (created or existing)',
  })
  @ApiResponse({ status: 401, description: 'User not synced' })
  @ApiResponse({ status: 404, description: 'Tour not found or unpublished' })
  add(
    @CurrentUser() user: User | null,
    @Param('tourId', new ParseUUIDPipe()) tourId: string,
  ): Promise<Wishlist> {
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_SYNCED',
        message: 'Run POST /auth/sync before using the wishlist',
      });
    }
    return this.wishlistService.add(user.id, tourId);
  }

  /**
   * `DELETE /wishlist/:tourId` — idempotent remove. Removing a tour that
   * isn't on the wishlist returns 204 without erroring.
   */
  @Delete(':tourId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Remove a tour from caller's wishlist (idempotent)",
  })
  @ApiNoContentResponse({ description: 'Removed (or already absent)' })
  @ApiResponse({ status: 401, description: 'User not synced' })
  async remove(
    @CurrentUser() user: User | null,
    @Param('tourId', new ParseUUIDPipe()) tourId: string,
  ): Promise<void> {
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_SYNCED',
        message: 'Run POST /auth/sync before using the wishlist',
      });
    }
    await this.wishlistService.remove(user.id, tourId);
  }

  /**
   * `GET /wishlist/me` — caller's wishlist, newest first, tour preview
   * joined.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Caller's wishlist with joined tour previews" })
  @ApiOkResponse({
    type: [WishlistItemDto],
    description: 'Array of wishlist rows + tour',
  })
  @ApiResponse({ status: 401, description: 'User not synced' })
  list(
    @CurrentUser() user: User | null,
  ): Promise<Array<Wishlist & { tour: Partial<Tour> }>> {
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_SYNCED',
        message: 'Run POST /auth/sync before fetching the wishlist',
      });
    }
    return this.wishlistService.findMineWithTour(user.id);
  }
}
