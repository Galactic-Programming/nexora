import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Global guard that enforces `@Roles(...)` metadata against the local DB
 * `User.role`.
 *
 * Pipeline ordering matters: this guard MUST run AFTER `SupabaseJwtGuard`
 * (which is responsible for attaching `req.currentUser`). Both are
 * registered in `AppModule` via `APP_GUARD` providers; NestJS executes them
 * in array-declaration order.
 *
 * Routes without `@Roles()` are passed through — i.e. role-less means
 * "any authenticated user is fine", not "anyone".
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * NestJS hook called once per request after the auth guard.
   *
   * Logic:
   *  1. Read the `@Roles(...)` metadata. No metadata → allow.
   *  2. No local user row attached → 401 `UNAUTHORIZED`. This typically
   *     means the FE forgot to call `/auth/sync` after sign-in.
   *  3. User's role not in the required list → 403 `FORBIDDEN` (e.g. a
   *     CUSTOMER hitting an admin-only endpoint).
   *  4. Otherwise allow.
   *
   * @param context  Nest execution context, narrowed to HTTP.
   * @returns        `true` to allow the request through.
   * @throws UnauthorizedException  When no synced user is on the request.
   * @throws ForbiddenException     When the user's role is insufficient.
   */
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.currentUser;

    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'User not synced — call POST /auth/sync first',
      });
    }

    if (!required.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Requires role: ${required.join(' or ')}`,
      });
    }

    return true;
  }
}
