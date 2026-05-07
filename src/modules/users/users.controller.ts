import {
  Body,
  Controller,
  Get,
  Patch,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

/**
 * HTTP surface for the current user's own profile.
 *
 * Both endpoints require a valid JWT (no `@Public()`) AND a synced local
 * row. The `@CurrentUser()` decorator returns the row attached by the auth
 * pipeline, or `null` when the user authenticated but never called
 * `/auth/sync`. We translate that null into a 401 with a stable
 * `USER_NOT_SYNCED` code so the FE knows to retry the sync.
 */
@ApiTags('Users')
@ApiBearerAuth('supabase-jwt')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * `GET /users/me` — return the caller's profile.
   *
   * @param user  Local DB row attached by `SupabaseJwtGuard`.
   *              Null when the user hasn't been synced yet.
   * @returns     The profile row.
   * @throws UnauthorizedException — `USER_NOT_SYNCED` when sync is missing.
   */
  @Get('me')
  @ApiOperation({ summary: 'Return the current user profile' })
  @ApiResponse({ status: 200, description: 'Profile' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({
    status: 404,
    description: 'User not yet synced — call /auth/sync first',
  })
  getMe(@CurrentUser() user: User | null): Promise<User> {
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_SYNCED',
        message:
          'Authenticated but local user record missing — call POST /auth/sync',
      });
    }
    return this.usersService.getMe(user.id);
  }

  /**
   * `PATCH /users/me` — partial profile update.
   *
   * Validation is automatic (`UpdateMeDto` + global `ValidationPipe`).
   * The handler itself only checks the synced-user precondition and
   * delegates to the service for the actual update.
   *
   * @param user  Local DB row attached by `SupabaseJwtGuard`.
   * @param body  Validated update payload.
   * @returns     The updated profile row.
   * @throws UnauthorizedException — `USER_NOT_SYNCED` when sync is missing.
   */
  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile' })
  @ApiResponse({ status: 200, description: 'Updated profile' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  updateMe(
    @CurrentUser() user: User | null,
    @Body() body: UpdateMeDto,
  ): Promise<User> {
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_SYNCED',
        message:
          'Authenticated but local user record missing — call POST /auth/sync',
      });
    }
    return this.usersService.updateMe(user.id, body);
  }
}
