import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Parameter decorator that injects the local DB `User` row for the caller.
 *
 * Populated by {@link import('../guards/supabase-jwt.guard').SupabaseJwtGuard}
 * after JWT verification. Returns `null` when the user has authenticated but
 * has NOT yet been synced into the local table — almost exclusively the
 * first call to `POST /auth/sync`. Controllers must handle the null case
 * (typically by either calling sync themselves or throwing
 * `USER_NOT_SYNCED`).
 *
 * @example
 * ```ts
 * @Get('me')
 * getMe(@CurrentUser() user: User | null) {
 *   if (!user) throw new UnauthorizedException(...);
 *   return user;
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.currentUser ?? null;
  },
);

/**
 * Parameter decorator that injects the verified Supabase identity (the JWT
 * payload subset) without requiring a local DB row.
 *
 * Use this — instead of `@CurrentUser()` — in flows where the local row may
 * not exist yet, e.g. the `/auth/sync` controllers themselves: they need
 * `sub` + `email` from the JWT to know WHO to upsert before any DB row
 * exists.
 *
 * @example
 * ```ts
 * @Post('sync')
 * sync(@SupabaseIdentity() identity: SupabaseAuthIdentity, @Body() dto: ...) {
 *   return this.authService.syncCustomer(identity, dto);
 * }
 * ```
 */
export const SupabaseIdentity = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.supabaseUser ?? null;
  },
);
