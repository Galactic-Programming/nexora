import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Injects the local DB User row attached by SupabaseJwtGuard / auth pipeline.
 * Returns `null` when the user has authenticated but not yet been synced
 * (typical only for the very first call to POST /auth/sync).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.currentUser ?? null;
  },
);

/**
 * Injects the raw Supabase identity (sub, email) — useful for /auth/sync
 * where the local DB row may not yet exist.
 */
export const SupabaseIdentity = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.supabaseUser ?? null;
  },
);
