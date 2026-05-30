import { SetMetadata } from '@nestjs/common';

/**
 * Reflector key used by {@link import('../guards/supabase-jwt.guard').SupabaseJwtGuard}
 * to detect routes annotated with {@link Public}. Exported because the guard
 * needs the same string constant — keep them in sync.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route handler (or whole controller) as publicly accessible.
 *
 * The auth guard is registered globally via `APP_GUARD`, so by default EVERY
 * route requires a valid Supabase JWT. Annotating with `@Public()` flips a
 * piece of metadata that the guard checks first and returns `true` for —
 * effectively opting that handler out of authentication.
 *
 * @example
 * ```ts
 * @Public()
 * @Get('health')
 * liveness() {
 *   return { status: 'ok' };
 * }
 * ```
 *
 * @returns A method/class decorator that NestJS Reflector reads.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
