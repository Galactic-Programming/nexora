import { registerAs } from '@nestjs/config';

/**
 * Strongly-typed shape of the `supabase.*` config namespace.
 *
 * Consumed by:
 * - `SupabaseJwtGuard` — reads `jwksUrl` + optional `jwtSecret`
 * - `AuthService.syncAdmin` — reads `adminEmails` for the allowlist check
 * - any future Supabase-Storage / Supabase-Admin code path
 */
export type SupabaseConfig = ReturnType<typeof supabaseConfig>;

/**
 * Loads Supabase-related env vars into a typed namespace.
 *
 * The non-null assertions (`!`) are safe here: `envValidationSchema` already
 * marked these keys `.required()`, so by the time this factory runs the
 * values are guaranteed to exist. Without the assertions, `process.env.X`
 * would have type `string | undefined` and force noisy guards everywhere.
 *
 * `adminEmails` is normalized once (split → trim → lowercase → drop empties)
 * so callers can do simple `includes()` checks without re-normalizing on
 * every request.
 *
 * @returns Frozen-at-boot Supabase configuration:
 *  - `url` / `anonKey` — public credentials, safe to share with FE
 *  - `serviceRoleKey` — privileged, MUST stay server-side only
 *  - `jwksUrl` — JSON Web Key Set endpoint for asymmetric JWT verification
 *  - `jwtSecret` — legacy HS256 secret, empty string for modern projects
 *  - `adminEmails` — lowercase allowlist for `/auth/admin/sync`
 */
export const supabaseConfig = registerAs('supabase', () => ({
  url: process.env.SUPABASE_URL!,
  anonKey: process.env.SUPABASE_ANON_KEY!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  jwksUrl: process.env.SUPABASE_JWKS_URL!,
  // Optional: `''` when the project signs with asymmetric keys (the default
  // for new Supabase projects since 2025). Guard treats empty as "no HS256".
  jwtSecret: process.env.SUPABASE_JWT_SECRET ?? '',
  adminEmails: (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
}));
