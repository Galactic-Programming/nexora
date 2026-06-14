# CLAUDE.md — tourism platform

Guidelines for any AI agent (or human) working in this repo. Keep this file
focused; deep detail lives in [`docs/`](docs/README.md) — this is the map +
the rules, not a duplicate of the docs.

> **Source of truth wins.** When this file or any doc disagrees with the code
> (`apps/api/src`, `apps/api/prisma/schema.prisma`, the running Swagger spec),
> the code is right — fix the doc. Don't trust a doc claim you can verify.

## What this is

Turborepo monorepo (pnpm) for a tourism booking platform.

| App / package | Path | Stack | Status |
| --- | --- | --- | --- |
| Backend API | `apps/api` | NestJS 11 · Prisma 7 · Supabase · Stripe · Resend | ✅ active |
| Customer web | `apps/web` | Next.js 16 · React 19 · @tourism/ui · next-intl · Supabase SSR | ✅ Phases A–D shipped |
| Admin web | `apps/admin` | Next.js 16 · @tourism/ui | 🚧 scaffold only (not started) |
| UI library | `packages/ui` | Base UI + custom + Shadcn-Studio blocks | ✅ `@tourism/ui` |

- Backend boots at `http://localhost:3000/api/v1` (Swagger `/api/docs`); web on `:3001`.
- Auth is **Supabase** (email/password + Google OAuth + 2FA TOTP). The API only
  verifies the JWT and mirrors users locally — do **not** rewrite to self-managed auth.

## How we work (standing conventions)

These are non-negotiable unless the user says otherwise in the moment.

1. **One feature = one branch.** Never commit feature work directly to `master`.
   Branch → implement → **the user reviews** → fast-forward merge → delete branch.
   Small docs/meta fixes may go straight to `master`.
2. **Ask before starting a new feature/phase.** The project pauses between
   features; confirm scope before writing code, and **confirm before any
   merge/push/branch-delete**.
3. **Spec → plan → execute.** For multi-step features: write a design spec +
   implementation plan under `docs/superpowers/{specs,plans}/` first, then
   execute task-by-task (TDD on pure logic), then review, then browser e2e,
   then update `docs/planning/roadmap.md`.
4. **TDD on logic.** Write the test first for pure functions / helpers / server
   actions. Target ≥80% on new logic. Visual/layout is covered by browser e2e.
5. **Frontend = layout-first, theme tokens only.** No hex colors — use theme
   tokens. **Reuse `@tourism/ui` first** (legacy → custom → Shadcn-Studio
   blocks) before building anything new. Visual polish/redesign is a deliberate
   later pass, not part of feature work.
6. **EN/VI parity is enforced.** Every user-facing string lives in
   `apps/web/messages/{en,vi}.json` with identical key sets (run a parity check).
7. **Postman is part of the contract.** A new/changed API endpoint updates the
   collection sources under `docs/postman/src/` + `pnpm postman:build`, committed
   with the code.
8. **BE-first discipline.** No mid-sprint schema changes — gaps go to
   `docs/planning/backlog.md`. **Pure-documentation** DTO changes (Swagger
   `@ApiProperty` only, no runtime change) are fine (the "B4.7" pattern).
9. **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`,
   `test:`, `chore:`). No AI attribution (disabled globally).

## Commands (from repo root)

```bash
pnpm install                         # postinstall runs `prisma generate`
pnpm dev                             # all apps in watch mode (api :3000, web :3001)
pnpm build | lint | typecheck | test # turbo across the workspace

pnpm postman:seed                    # seed test data + self-signed paid-booking harness
pnpm postman:test                    # run the Newman API suite (needs the seed first)

# Per-package (filter):
pnpm --filter @tourism/api start:dev        # API in watch mode
pnpm --filter @tourism/api test             # jest
pnpm --filter @tourism/api exec prisma studio
pnpm --filter @tourism/web test             # vitest
pnpm --filter @tourism/web api:types        # regen src/lib/api/schema.d.ts (API must be running)
```

- Node ≥ 22, pnpm 10 (`corepack enable`). Backend env file: `apps/api/.env`.

## Layout

```text
apps/api      NestJS service — see docs/reference/architecture.md (module map, request lifecycle)
apps/web      customer FE — src/{app,features,lib,i18n}; per-app CLAUDE.md warns Next 16 ≠ training data
apps/admin    admin FE — scaffold only
packages/     @tourism/ui (legacy / custom / studio blocks) · eslint-config · typescript-config
docs/         single source of truth: reference/ · runbooks/ · planning/ · superpowers/ · postman/
```

Start reading at [`docs/README.md`](docs/README.md). Key refs:
[architecture](docs/reference/architecture.md) ·
[api-overview](docs/reference/api-overview.md) ·
[erd](docs/reference/erd.md) ·
[roadmap](docs/planning/roadmap.md) ·
[local-dev runbook](docs/runbooks/local-dev.md).

## Gotchas (load-bearing, non-obvious)

- **pnpm 10 reads `overrides` from `pnpm-workspace.yaml`, NOT `package.json`.**
- **Prisma 7 needs a driver adapter** (`PrismaPg`); schema-level `url`/`directUrl`
  were removed (config lives in `prisma.config.ts`). The Supabase **transaction
  pooler** (`connection_limit=1`) can't start a batch `$transaction` under
  concurrency — use `Promise.all` for parallel reads (e.g. list + count).
- **Omit empty optional strings** from booking/review request bodies — backend
  `@Length`/`@IsOptional` validators reject `""`.
- **After any BE response-DTO change**, regenerate the FE client:
  `pnpm --filter @tourism/web api:types` (API must be running on :3000).
- **Stripe webhook in e2e**: localhost can't receive real Stripe webhooks — use
  the self-signed HMAC harness (`pnpm postman:seed`, or `.tmp/fire-webhook.mjs`)
  to drive PENDING→PAID.
- **Next.js 16 is not the Next.js in your training data** — read
  `apps/web/node_modules/next/dist/docs/` before writing FE routing/RSC code
  (see `apps/web/CLAUDE.md`).

## AI infra in this repo

- `.claude/commands/` — project slash commands: `/gate` (quality gate),
  `/seed` (test data), `/regen-types` (FE OpenAPI client after a BE DTO change),
  `/new-feature <desc>` (kick off the spec→plan→execute flow).
- `.agents/skills/` — vendored Agent Skills (Next, shadcn, Stripe, Supabase),
  symlinked into `.claude/skills`; restore with `pnpm dlx skills install`.
- `docs/superpowers/` — committed design specs + implementation plans per feature.
- `.remember/` — rolling session handoff notes (not the contract; code + docs are).
