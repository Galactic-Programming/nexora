import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Reflector key used by {@link import('../guards/roles.guard').RolesGuard}
 * to read the role list configured by {@link Roles}.
 */
export const ROLES_KEY = 'roles';

/**
 * Restricts a route handler to users whose `role` matches ONE of the listed
 * roles (logical OR — any match is sufficient).
 *
 * Order in the guard pipeline matters: `SupabaseJwtGuard` must run BEFORE
 * `RolesGuard` so that `req.currentUser` is populated. Both are registered
 * globally in `AppModule` (see `APP_GUARD` providers).
 *
 * Without `@Roles()` a route is accessible to any authenticated user
 * (CUSTOMER and ADMIN alike).
 *
 * @param roles  One or more `UserRole` values that are allowed.
 * @returns A method/class decorator NestJS reads via Reflector.
 *
 * @example
 * ```ts
 * @Roles(UserRole.ADMIN)
 * @Patch(':id/refund')
 * refund(@Param('id') id: string) { ... }
 * ```
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
