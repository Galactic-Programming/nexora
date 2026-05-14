# Runbook — Local development

> 🇻🇳 Bản tiếng Việt: [`../../vi/runbooks/local-dev.md`](../../vi/runbooks/local-dev.md).

## Prerequisites

- Node.js ≥ 22 (the repo's TypeScript build targets ES2023)
- pnpm ≥ 10
- A Supabase project (free tier is fine)
- A Stripe test account

## 1. Clone & install

```bash
git clone <repo-url> tourism-be-api
cd tourism-be-api
pnpm install
```

## 2. Environment variables

```bash
cp .env.example .env
```

Fill the placeholders in `.env`. The two most important right now:

| Variable | Where to find |
| --- | --- |
| `DATABASE_URL` | Supabase Dashboard → Connect → **Transaction pooler** (port **6543**, host `aws-N-<region>.pooler.supabase.com`). Append `?pgbouncer=true&connection_limit=1`. Used at runtime by Prisma. |
| `DIRECT_URL` | Same Connect page → **Session pooler** (port **5432**, same hostname). Used by `prisma migrate`. **Do NOT** append `pgbouncer=true` here. |
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Project Settings → API → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` (keep secret) |
| `SUPABASE_JWKS_URL` | `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` |
| `SUPABASE_JWT_SECRET` | **Optional.** Only set for legacy projects still on HS256. Modern projects (asymmetric ES256/RS256/EdDSA — default since 2025) don't need it. To check: open `SUPABASE_JWKS_URL` in a browser; if you see `"alg":"ES256"` (or RS256/EdDSA), leave the secret blank. |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → Secret key (test mode) |
| `STRIPE_WEBHOOK_SECRET` | After running `stripe listen` (see Sprint B3 runbook) |
| `RESEND_API_KEY` | Resend Dashboard → API Keys |

The app will refuse to start if any required variable is missing — Joi prints a list of all violations.

### Why pooler instead of "Direct connection"?

Supabase exposes 3 connection paths. We pick the pooler for both URLs:

| Path | Port | Hostname | Why we (don't) use it |
| --- | --- | --- | --- |
| Direct connection | 5432 | `db.<ref>.supabase.co` | **Skip** — IPv6 only on free tier. |
| Session pooler | 5432 | `aws-N-<region>.pooler.supabase.com` | ✅ `DIRECT_URL` for migrations (supports prepared statements + long transactions). |
| Transaction pooler | 6543 | `aws-N-<region>.pooler.supabase.com` | ✅ `DATABASE_URL` for runtime queries (serverless-friendly, no prepared statements). |

This setup works without buying the IPv4 add-on.

## 3. Database migrations

```bash
pnpm exec prisma migrate dev --name init
pnpm exec prisma generate
```

`prisma.config.ts` automatically reads `DIRECT_URL` for migrations. The runtime `PrismaClient` uses `DATABASE_URL` via the `PrismaPg` adapter.

## 4. Run dev server

```bash
pnpm start:dev
```

You should see:

```terminal
🚀 Tourism API listening on http://localhost:3000/api/v1
📚 Swagger UI: http://localhost:3000/api/docs
```

## 5. Smoke test

```bash
curl http://localhost:3000/api/v1/health
# {"data":{"status":"ok","uptime":...,"timestamp":"..."},"error":null}

curl http://localhost:3000/api/v1/health/ready
# {"data":{"status":"ok","checks":{"database":"up"},"timestamp":"..."},"error":null}
```

Open <http://localhost:3000/api/docs> for the Swagger UI.

## 6. Postman

Import:

1. `docs/postman/tourism-api.json` (collection)
2. `docs/postman/environments/local.postman_environment.json` (environment)

Select the `tourism-api · local` environment in Postman, then run the **Health** folder. All requests should pass.

> Workflow reminder: every time we ship a new endpoint, the Postman collection JSON in this repo MUST be updated and committed alongside the code.

## 7. Useful scripts

```bash
pnpm lint           # eslint --fix
pnpm format         # prettier --write
pnpm build          # nest build (type-check + transpile)
pnpm test           # jest
pnpm test:cov       # jest + coverage
pnpm exec prisma studio   # browse the DB visually
pnpm exec prisma validate # validate schema.prisma
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Config validation error: "X" is required` | Missing env var. Copy from `.env.example`, fill, restart. |
| `PrismaClientInitializationError ... requires either "adapter" or "accelerateUrl"` | Prisma 7 requires a driver adapter. We already wire `PrismaPg`; reinstall with `pnpm install` if `node_modules` was wiped. |
| `Unsupported route path: "/api/v1/*"` warning at boot | **Benign.** NestJS 11 sets a global prefix and internally registers a catch-all `/api/v1/*`. path-to-regexp v8 dropped the bare `*` syntax; Nest's `LegacyRouteConverter` auto-rewrites it to `/api/v1/{*path}` at startup. App still serves all routes correctly. Wait for an upstream Nest cleanup. |
| `Warning: --localstorage-file was provided without a valid path` (jest) | **Benign.** Known Node.js 25 + jest issue — an empty flag is forwarded to the worker process. No effect on test results. Either ignore or downgrade to Node 22 LTS. |
| `Synced customer undefined (supabaseId=undefined)` in `jest` output | Should NOT appear anymore — `auth.service.spec.ts` silences `Logger.prototype.log` in `beforeAll`. If you see it, you reverted that mock. |
| `prisma migrate dev` fails with "Can't reach database" | Ensure `DIRECT_URL` (port 5432) is set, not just the pooler. The pooler doesn't accept session-mode statements migrations need. |
| Stripe webhook returns 400 "Invalid signature" | The raw body middleware must register **before** the global JSON parser. We already wire this in `main.ts`. Double-check the path matches your `STRIPE_WEBHOOK_SECRET`. |
