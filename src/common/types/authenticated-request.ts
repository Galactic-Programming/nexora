import type { Request } from 'express';
import type { User } from '@prisma/client';

/**
 * Subset of a Supabase access-token payload that the guard exposes downstream.
 *
 * Populated by {@link import('../guards/supabase-jwt.guard').SupabaseJwtGuard}
 * after JWT verification succeeds, and read by:
 *   - `@SupabaseIdentity()` parameter decorator
 *   - `AuthService.syncCustomer / syncAdmin`
 *
 * @property sub            The user's stable Supabase auth UUID. Used as the
 *                          natural key when upserting into the local `users`
 *                          table — never trust the request body for this.
 * @property email          Verified email claim from the JWT (case preserved).
 *                          Lowercased before persisting to the DB.
 * @property emailVerified  `true` if Supabase confirmed the email — derived
 *                          from `email_verified` or `email_confirmed_at`.
 * @property raw            Full decoded JWT payload. Kept around for future
 *                          claims (`app_metadata`, custom claims, ...) without
 *                          forcing this type to grow.
 */
export type SupabaseAuthIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  raw: Record<string, unknown>;
};

/**
 * Express `Request` augmented by the auth pipeline.
 *
 * After `SupabaseJwtGuard` runs:
 * - `supabaseUser` is always present on protected routes (the guard throws
 *   401 otherwise).
 * - `currentUser` is the matching row in our local `users` table, OR `null`
 *   if the user authenticated but hasn't called `/auth/sync` yet (first
 *   sign-in). Controllers handle that case by either calling sync themselves
 *   or returning `USER_NOT_SYNCED`.
 *
 * Both fields are optional in the type because Public routes skip the guard,
 * and TypeScript should force callers to narrow before use.
 */
export interface AuthenticatedRequest extends Request {
  supabaseUser?: SupabaseAuthIdentity;
  currentUser?: User | null;
}
