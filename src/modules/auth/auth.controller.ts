import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { SupabaseIdentity } from '../../common/decorators/current-user.decorator';
import type { SupabaseAuthIdentity } from '../../common/types/authenticated-request';
import { AuthService } from './auth.service';
import { SyncUserDto } from './dto/sync-user.dto';

@ApiTags('Auth')
@ApiBearerAuth('supabase-jwt')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync the JWT-bearing user into local DB as CUSTOMER',
    description:
      'Idempotent. The first call creates a `User` row keyed by the Supabase `sub`; subsequent calls refresh email/profile fields. ' +
      'The frontend should call this once after sign-in/sign-up before issuing any other authenticated request.',
  })
  @ApiResponse({ status: 200, description: 'User upserted' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  syncCustomer(
    @SupabaseIdentity() identity: SupabaseAuthIdentity,
    @Body() body: SyncUserDto,
  ): Promise<User> {
    return this.authService.syncCustomer(identity, body);
  }

  @Post('admin/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync the JWT-bearing user as ADMIN (allowlist gated)',
    description:
      'Same upsert as `/auth/sync` but elevates the user to ADMIN. Caller email must be in `ADMIN_EMAILS`; otherwise 403. ' +
      'Use this after admins log into the admin frontend.',
  })
  @ApiResponse({ status: 200, description: 'User upserted as ADMIN' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Email not on admin allowlist' })
  syncAdmin(
    @SupabaseIdentity() identity: SupabaseAuthIdentity,
    @Body() body: SyncUserDto,
  ): Promise<User> {
    return this.authService.syncAdmin(identity, body);
  }
}
