# Architecture — tourism-be-api

## High-level

```flow
                      ┌────────────────┐
   FE customer ─┐     │                │
                ├──►  │  NestJS API    │ ──► Prisma ──► Supabase Postgres
   FE admin   ──┘     │  (Express)     │ ──► @supabase/supabase-js (Storage signed URLs)
                      │                │ ──► Stripe SDK
                      └────────┬───────┘ ──► Resend (email)
                               │
                               ▼
                    Supabase JWKS (verify JWT)
```

- Single Turborepo monorepo: `apps/api` (this NestJS service), `apps/web` (customer FE), `apps/admin` (admin FE). The two FE apps are currently empty templates — no FE work done yet.
- Backend is a single NestJS 11 service. No microservices for the graduation scope.
- Supabase Auth handles login on the frontend; this API verifies the JWT and mirrors users into a local `users` table.

## Module map

```structure
src/
├── main.ts                 Bootstrap (helmet, CORS, ValidationPipe, Swagger,
│                           raw body for /payments/webhook)
├── app.module.ts           Wires Config, Logger, Throttler, Prisma, global
│                           filter/interceptor/guards, feature modules
├── config/                 ConfigModule + Joi schema; namespaced configs
│                           (app, supabase, stripe, email, throttler)
├── prisma/                 PrismaService extends PrismaClient with PrismaPg
│                           adapter (Prisma 7 requires a driver adapter)
├── common/
│   ├── types/              ApiResponse envelope, AuthenticatedRequest
│   ├── dto/                ApiErrorDto, ApiMetaDto — Swagger-renderable
│   │                       counterparts of the envelope types (B4.7)
│   ├── decorators/         @Public, @Roles, @CurrentUser, @SupabaseIdentity
│   ├── guards/             SupabaseJwtGuard (JWKS + HS256 fallback),
│   │                       RolesGuard
│   ├── filters/            HttpExceptionFilter — uniform error envelope
│   └── interceptors/       TransformInterceptor — wraps responses in
│                           {data, error, meta}
└── modules/                auth, users, destinations, tours, departures,
                            bookings, payments, reviews, wishlist, uploads,
                            admin-stats, email, health
```

Per-module `dto/` folders hold both request DTOs (e.g. `CreateTourDto`)
and response DTOs (e.g. `TourDto`, `TourWithStatsDto`, `TourDetailDto`)
that Swagger renders for `openapi-typescript-codegen` to consume.
See [roadmap.md](../planning/roadmap.md) Sprint B4.7 for the response
DTO coverage rationale.

## Request lifecycle

1. **Throttler guard** — global rate limit (100 req / 60s default).
2. **SupabaseJwtGuard** — verifies `Authorization: Bearer <jwt>` against
   Supabase JWKS. Routes annotated with `@Public()` skip this. Sets
   `req.supabaseUser` (identity from JWT) and `req.currentUser`
   (local `User` row, may be null until first `/auth/sync`).
3. **RolesGuard** — enforces `@Roles(UserRole.ADMIN)` etc. against
   `req.currentUser.role`.
4. **ValidationPipe** — class-validator + class-transformer; whitelist + forbid
   non-whitelisted; implicit type conversion.
5. **Controller** → service → Prisma.
6. **TransformInterceptor** — wraps return value in `{data, error: null}`.
7. **HttpExceptionFilter** — catches all exceptions, returns
   `{data: null, error: {code, message, details?}}` with proper HTTP status.

## Response envelope

Every response uses:

```json
{
  "data": <payload> | null,
  "error": null | { "code": "STRING_CODE", "message": "...", "details": ... },
  "meta": { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 }
}
```

Pagination: controllers return `{ items, meta }`; the interceptor moves
`items` to `data` and `meta` to envelope-level `meta`.

## Authentication

- Frontend calls `supabase.auth.signInWithPassword()` / OAuth → receives `access_token`.
- All protected requests include `Authorization: Bearer <access_token>`.
- `SupabaseJwtGuard` uses [`jose`](https://github.com/panva/jose) — the library Supabase recommends in their JWT verification guide:
  - Reads the `alg` from the JWT protected header.
  - For `ES256` / `RS256` / `EdDSA` (Supabase's modern asymmetric signing — default for new projects in 2025+): verifies against `createRemoteJWKSet(SUPABASE_JWKS_URL)` with a 10-minute cache (matches Supabase Edge cache TTL).
  - For `HS256` (legacy projects only): verifies with `SUPABASE_JWT_SECRET`. If the secret isn't configured, the guard rejects HS256 tokens with a clear error.
- After verification, the local DB user row is loaded by `supabaseId` and attached to the request.

## Database

- Provider: PostgreSQL (Supabase managed).
- ORM: Prisma 7 with **PrismaPg** driver adapter (Prisma 7 requires a driver adapter — schema-level `url`/`directUrl` were removed).
- Connection strategy via Supabase **Supavisor** (works for IPv4 clients on free tier):
  - `DATABASE_URL` → **Transaction pooler** (port 6543, `aws-N-<region>.pooler.supabase.com`). Append `?pgbouncer=true&connection_limit=1`. Used by `PrismaClient` at runtime. Prepared statements are disabled automatically.
  - `DIRECT_URL` → **Session pooler** (port 5432, same hostname). Used by `prisma migrate` (declared in `prisma.config.ts`). Supports prepared statements + long transactions, which migrations need.
  - We do NOT use the "Direct Connection" (`db.<ref>.supabase.co:5432`) because it requires IPv6 or a paid IPv4 add-on.
- Schema: see [`erd.md`](erd.md) and [`prisma/schema.prisma`](../../apps/api/prisma/schema.prisma).

## Configuration

- `@nestjs/config` with Joi validation (`src/config/env.validation.ts`).
- Process refuses to start if any required env var is missing or invalid.
- Namespaced via `registerAs`:
  - `app.*`   — port, prefix, log level, CORS origins, frontendUrl
  - `supabase.*` — URL, keys, JWKS, admin email allowlist
  - `stripe.*` — secret key, webhook secret, default currency
  - `email.*` — Resend API key, from address
  - `throttler.*` — TTL, limit

## Logging

- `nestjs-pino` with `pino-pretty` in dev; JSON in production.
- Auth headers redacted.
- HTTP request/response auto-logged with timing.

## Stripe webhook handling

- Path: `POST /api/v1/payments/webhook` (Sprint B3).
- Raw body required for signature verification — wired in `main.ts` **before** the global JSON parser via `express.raw()`.
- Idempotency: `payment_events` table with UNIQUE `stripe_event_id`. Replays return 200 without re-processing.

## Known caveats

- The path-to-regexp warning at boot (`Unsupported route path: "/api/v1/*"`) is benign. NestJS auto-converts the legacy syntax. Will be cleaned up when we add OpenAPI route filtering.
- Prisma 7 dropped `datasources` and `directUrl` from schema; we use `prisma.config.ts` instead.
