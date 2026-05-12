import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 config.
 *
 * Connection URLs:
 * - Runtime (`PrismaClient`):       reads DATABASE_URL from env (Supabase pooler, port 6543)
 * - Migrations (`prisma migrate`):  reads DIRECT_URL from env (Supabase direct, port 5432)
 *
 * Prisma 7 dropped the `directUrl` schema field; the migration engine now picks
 * up `DIRECT_URL` automatically when present in the environment.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    // Registered by `prisma db seed`. ts-node transpiles in-memory so we
    // don't have to maintain a built JS copy. `--transpile-only` skips
    // type-checking (we trust `pnpm build` to catch errors before commit).
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});
