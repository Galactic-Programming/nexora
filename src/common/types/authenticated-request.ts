import type { Request } from 'express';
import type { User } from '@prisma/client';

/**
 * Identity extracted from the validated Supabase JWT.
 * Set by SupabaseJwtGuard onto `req.supabaseUser`.
 */
export type SupabaseAuthIdentity = {
  sub: string; // Supabase auth UUID
  email: string;
  emailVerified: boolean;
  raw: Record<string, unknown>; // full decoded payload
};

/**
 * Request augmented after auth pipeline:
 *   - `supabaseUser`: identity from JWT (always present after guard)
 *   - `currentUser`:  local DB User row (present after sync; may be null
 *                     during /auth/sync first-time call)
 */
export interface AuthenticatedRequest extends Request {
  supabaseUser?: SupabaseAuthIdentity;
  currentUser?: User | null;
}
