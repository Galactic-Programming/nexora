import { registerAs } from '@nestjs/config';

export type SupabaseConfig = ReturnType<typeof supabaseConfig>;

export const supabaseConfig = registerAs('supabase', () => ({
  url: process.env.SUPABASE_URL!,
  anonKey: process.env.SUPABASE_ANON_KEY!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  jwksUrl: process.env.SUPABASE_JWKS_URL!,
  jwtSecret: process.env.SUPABASE_JWT_SECRET ?? '',
  adminEmails: (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
}));
