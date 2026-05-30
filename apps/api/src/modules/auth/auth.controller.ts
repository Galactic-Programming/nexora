import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { SupabaseIdentity } from '../../common/decorators/current-user.decorator';
import type { SupabaseAuthIdentity } from '../../common/types/authenticated-request';
import { UserDto } from '../users/dto/user.dto';
import { AuthService } from './auth.service';
import { SyncUserDto } from './dto/sync-user.dto';

/**
 * HTTP surface for the user-mirroring workflow.
 *
 * Both endpoints require a valid Supabase JWT (no `@Public()`); the global
 * `SupabaseJwtGuard` runs first. The `@SupabaseIdentity()` parameter
 * decorator hands us the verified JWT subset — we never read identity from
 * the body. See {@link AuthService} for the upsert semantics.
 *
 * `@HttpCode(200)` overrides Nest's default `201 Created` because these are
 * "create or refresh" idempotent operations, not pure creates.
 */
@ApiTags('Auth')
@ApiBearerAuth('supabase-jwt')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * `POST /auth/sync` — call once per session from the customer FE right
   * after `supabase.auth.signInWithPassword()` / OAuth.
   *
   * Idempotent: subsequent calls refresh profile fields (email, fullName,
   * phone, locale) but never downgrade an existing ADMIN user.
   *
   * @param identity  Verified Supabase identity (auto-injected).
   * @param body      Optional profile metadata.
   * @returns         The local DB user row.
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync the JWT-bearing user into local DB as CUSTOMER',
    description:
      'Idempotent. The first call creates a `User` row keyed by the Supabase `sub`; subsequent calls refresh email/profile fields. ' +
      'The frontend should call this once after sign-in/sign-up before issuing any other authenticated request.',
  })
  @ApiOkResponse({ type: UserDto, description: 'User upserted' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  syncCustomer(
    @SupabaseIdentity() identity: SupabaseAuthIdentity,
    @Body() body: SyncUserDto,
  ): Promise<User> {
    return this.authService.syncCustomer(identity, body);
  }

  /**
   * `POST /auth/admin/sync` — admin counterpart of `/auth/sync`.
   *
   * Adds an allowlist check before promoting the user to ADMIN. Returns
   * 403 if the email is not on `ADMIN_EMAILS`. Idempotent.
   *
   * @param identity  Verified Supabase identity (auto-injected).
   * @param body      Optional profile metadata.
   * @returns         The local DB user row with `role: ADMIN`.
   * @throws ForbiddenException — when the email is not allowlisted.
   */
  @Post('admin/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync the JWT-bearing user as ADMIN (allowlist gated)',
    description:
      'Same upsert as `/auth/sync` but elevates the user to ADMIN. Caller email must be in `ADMIN_EMAILS`; otherwise 403. ' +
      'Use this after admins log into the admin frontend.',
  })
  @ApiOkResponse({ type: UserDto, description: 'User upserted as ADMIN' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Email not on admin allowlist' })
  syncAdmin(
    @SupabaseIdentity() identity: SupabaseAuthIdentity,
    @Body() body: SyncUserDto,
  ): Promise<User> {
    return this.authService.syncAdmin(identity, body);
  }
}
