# Tourism API — Roadmap & Progress Tracker

Single source of truth for sprint progress. Update **every time** a sub-feature is shipped (code + tests + Postman + docs).

Docs layout: see [`../../README.md`](../../README.md). Bilingual content lives in `en/{reference,runbooks}/` + `vi/{reference,runbooks}/`; this `planning/` folder is EN-only (sits inside `en/`).

---

## Legend

| Symbol | Meaning |
| --- | --- |
| ✅ | Done & merged (code + test + Postman + docs all updated) |
| 🚧 | In progress |
| ⬜ | Not started |
| 🔒 | Blocked / waiting |

---

## Sprint B0 — Foundation

| # | Sub-feature | Status | Postman | Docs |
| --- | --- | --- | --- | --- |
| B0.1 | Install runtime deps (Nest config, Prisma, Stripe, Supabase, Resend, helmet, throttler, pino) | ✅ | n/a | this file |
| B0.2 | `.env.example` with all required variables | ✅ | n/a | runbooks/local-dev |
| B0.3 | Prisma schema for all entities (User, Destination, Tour, Departure, Booking, Review, Wishlist, PaymentEvent) | ✅ | n/a | erd.md |
| B0.4 | ConfigModule + Joi validation | ✅ | n/a | architecture.md |
| B0.5 | PrismaModule + PrismaService (PrismaPg adapter) | ✅ | n/a | architecture.md |
| B0.6 | Common: response envelope, exception filter, transform interceptor, decorators | ✅ | n/a | architecture.md |
| B0.7 | SupabaseJwtGuard (JWKS + HS256 fallback) + RolesGuard | ✅ | n/a | architecture.md |
| B0.8 | `GET /health`, `GET /health/ready` | ✅ | Health folder | architecture.md |
| B0.9 | `main.ts`: helmet, CORS, ValidationPipe, Swagger, raw body for `/payments/webhook` | ✅ | n/a | runbooks/local-dev |
| B0.10 | Postman collection `tourism-api.json` + `local` environment | ✅ | Health folder | runbooks/postman-auth |
| B0.11 | GitHub Actions CI (lint + typecheck + prisma validate + jest) | ✅ | n/a | `.github/workflows/ci.yml` |
| B0.12 | Docs scaffold (en + vi architecture, local-dev runbook, erd.md, this roadmap) | ✅ | n/a | — |

**Sprint B0 verification (already passing locally):**

```bash
pnpm install
cp .env.example .env  # fill placeholders
pnpm start
# Server: http://localhost:3000/api/v1
# Swagger: http://localhost:3000/api/docs
curl http://localhost:3000/api/v1/health
# → {"data":{"status":"ok",...},"error":null}
```

---

## Sprint B1 — Auth & Users

| # | Sub-feature | Status | Postman | Docs |
| --- | --- | --- | --- | --- |
| B1.1 | `POST /auth/sync` — first-time sync user from Supabase JWT | ✅ | Auth | api-overview, runbooks/postman-auth |
| B1.2 | `POST /auth/admin/sync` — gated by `ADMIN_EMAILS` allowlist | ✅ | Auth | api-overview, runbooks/postman-auth |
| B1.3 | `GET /users/me` — current profile | ✅ | Users | api-overview |
| B1.4 | `PATCH /users/me` — update full_name, phone, locale | ✅ | Users | api-overview |
| B1.5 | Unit test: AuthService.syncCustomer + syncAdmin (5/5 pass) | ✅ | n/a | n/a |

**Sprint B1 verification (passed end-to-end against real Supabase):**

```bash
# Real Supabase ES256 JWT → /auth/sync → /users/me → PATCH /users/me
pnpm exec newman run docs/postman/tourism-api.json \
  -e docs/postman/environments/local.postman_environment.json
# → 14 assertions executed, 0 failed
```

---

## Sprint B2 — Destinations + Tours + Departures

| # | Sub-feature | Status | Postman | Docs |
| --- | --- | --- | --- | --- |
| B2.1 | Destinations CRUD (admin) + public list/detail | ✅ | Destinations (Public+Admin) | api-overview |
| B2.2 | Tours admin CRUD | ✅ | Tours (Admin) | api-overview |
| B2.3 | Tours public list (filter+sort+pagination) + detail | ✅ | Tours (Public) | api-overview |
| B2.4 | TourItineraryDay nested CRUD | ✅ | Tours (Admin) — Itinerary | api-overview |
| B2.5 | Departures CRUD + public list per tour | ✅ | Tours (Public/Admin) — Departures | api-overview |
| B2.6 | Uploads: `POST /admin/uploads/signed-url` (Cloudinary signed upload; migrated off Supabase Storage — `MediaAsset` table, image+video) | ✅ | Uploads (Admin) | runbooks/uploads |
| B2.7 | Seed script: 4 destinations + 10 tours + 30 departures | ✅ | n/a | runbooks/seed |

---

## Sprint B3 — Bookings + Stripe

| # | Sub-feature | Status | Postman | Docs |
| --- | --- | --- | --- | --- |
| B3.1 | `POST /bookings` → Stripe Checkout session | ✅ | Bookings | api-overview |
| B3.2 | `GET /bookings/me` — user history | ✅ | Bookings | api-overview |
| B3.3 | `GET /bookings/:code` — owner or admin | ✅ | Bookings | api-overview |
| B3.4 | `POST /payments/webhook` — Stripe webhook + idempotency | ✅ | Payments (Webhook) | runbooks/stripe-testing |
| B3.5 | `POST /admin/bookings/:id/refund` | ✅ | Admin / Bookings | api-overview, runbooks/email |
| B3.6 | Email service (Resend) — confirmation + refunded EN/VI | ✅ | n/a | runbooks/email |

---

## Sprint B4 — Reviews + Wishlist + Admin

| # | Sub-feature | Status | Postman | Docs |
| --- | --- | --- | --- | --- |
| B4.1 | `POST /reviews` — only for PAID bookings | ✅ | Reviews | api-overview |
| B4.2 | `GET /tours/:slug/reviews` — public, approved only | ✅ | Reviews (Public) | api-overview |
| B4.3 | `PATCH /admin/reviews/:id` — approve/reject | ✅ | Admin / Reviews | api-overview |
| B4.4 | Wishlist endpoints | ✅ | Wishlist | api-overview |
| B4.5 | `GET /admin/stats` — extended (revenue, status, top×3, trend, MoM, conversion) | ✅ | Admin / Stats | api-overview |

---

## Sprint B4.6 — Figma alignment (pre-FE)

Schema + service tweaks so the FE customer template can wire 1:1 to the Figma design without backend rework mid-sprint. Detailed plan in [`sprints/b4.6-figma-alignment.md`](sprints/b4.6-figma-alignment.md).

| # | Sub-feature | Status | Postman | Docs |
| --- | --- | --- | --- | --- |
| B4.6.1 | Migration: `Tour.isFeatured` + `@@index([isFeatured, isPublished])` | ✅ | n/a | erd, sprints/b4.6 |
| B4.6.2 | Migration: extend `TourCategory` enum with `HONEYMOON`, `MUSICAL` | ✅ | n/a | erd, sprints/b4.6 |
| B4.6.3 | `ListToursQueryDto`: `featured?` + 2-axis `sortBy`/`sortOrder` (pre-existing) | ✅ | Tours (Public) | api-overview |
| B4.6.4 | Tour list + detail response: `averageRating`, `reviewsCount`, `peopleGoing` per card | ✅ | Tours (Public) | api-overview |
| B4.6.5 | Admin DTOs: `isFeatured?` on `CreateTourDto` + `UpdateTourDto` (pre-existing) | ✅ | Tours (Admin) | api-overview |
| B4.6.6 | Seed script: relabel `phu-quoc-sunset-cruise`→HONEYMOON + featured, `hoi-an-lantern-night`→MUSICAL; FK-safe departure reset | ✅ | n/a | runbooks/seed |
| B4.6.7 | Tests: stats join on list, stats join on detail, empty-page skip | ✅ | n/a | n/a |
| B4.6.8 | Docs: backlog.md (Build Your Own Package, Newsletter) + sprint plan | ✅ | n/a | backlog, sprints/b4.6 |

---

## Frontend phase (after BE B0–B4.6)

Customer FE first, admin FE next. Both live inside this Turborepo as `apps/web` (customer) and `apps/admin` (admin); BE-first sprint discipline stays in effect (no mid-sprint schema changes — gaps go to BACKLOG).

> **Status correction (2026-06-03):** an earlier standalone customer FE (separate `tourism-frontend-customer` repo, which had reached ~C1.4) was **discarded** when the project consolidated into this Turborepo. `apps/web` and `apps/admin` are both **empty templates — no FE work has been done.** The prior C0–C1.4 progress does **not** carry over and any earlier "in progress" status here was stale.

Customer FE is split into four sequential sub-projects, each on its own feature branch: **A. Foundation → B. Browse → C. Auth & Account → D. Booking & Review**.

| Phase | App | Status | Plan doc |
| --- | --- | --- | --- |
| Customer FE — A. Foundation | `apps/web` | ✅ Done on `feat/customer-fe-foundation` (data layer: openapi-fetch client + envelope unwrap + typed env; Supabase SSR wiring; layout shell; Home with real featured tours; Vitest suite) | [specs/2026-06-03-customer-fe-foundation-design.md](../superpowers/specs/2026-06-03-customer-fe-foundation-design.md), [plans/2026-06-03-customer-fe-foundation.md](../superpowers/plans/2026-06-03-customer-fe-foundation.md) |
| Customer FE — B. Browse | `apps/web` | ✅ Complete — B1 Packages Archive → B2 Package Detail → B3 Destinations all done | see B1–B3 below |
| Customer FE — B1. Packages Archive | `apps/web` | ✅ Done on `feat/customer-fe-browse-archive` (RSC `/tours` list: URL filters/sort/pagination, `listTours` w/ meta, reuse TourCard+PaginationControl, EN/VI). Note: tour cards render imageless until tours are seeded with Cloudinary `media`. | [specs/2026-06-04-customer-fe-browse-archive-design.md](../superpowers/specs/2026-06-04-customer-fe-browse-archive-design.md), [plans/2026-06-04-customer-fe-browse-archive.md](../superpowers/plans/2026-06-04-customer-fe-browse-archive.md) |
| Customer FE — B2. Package Detail | `apps/web` | ✅ Done on `feat/customer-fe-browse-detail` (RSC `/tours/[slug]`: hero, tab-nav, info, departures sidebar w/ stub Book CTA, itinerary, location, gallery, reviews; EN/VI; notFound on 404; 43 web tests). | [specs/2026-06-05-customer-fe-browse-detail-design.md](../superpowers/specs/2026-06-05-customer-fe-browse-detail-design.md), [plans/2026-06-05-customer-fe-browse-detail.md](../superpowers/plans/2026-06-05-customer-fe-browse-detail.md) |
| Customer FE — B3. Destinations | `apps/web` | ✅ Done on `feat/customer-fe-browse-destinations` (RSC `/destinations` list: hero, URL search (`?q=`) + pagination, seeded Cloudinary hero media; `/destinations/[slug]` detail: hero + info + tours-in-destination grid reusing B1 `TourGrid`/`listTours({destination})`; EN/VI; notFound on 404; loading skeletons; 56 web tests). Phase B (Browse) complete. | [specs/2026-06-08-customer-fe-browse-destinations-design.md](../superpowers/specs/2026-06-08-customer-fe-browse-destinations-design.md), [plans/2026-06-08-customer-fe-browse-destinations.md](../superpowers/plans/2026-06-08-customer-fe-browse-destinations.md) |
| Customer FE — C. Auth & Account | `apps/web` | ⬜ Not started | TBD |
| Customer FE — D. Booking & Review | `apps/web` | ⬜ Not started | TBD |
| Admin FE | `apps/admin` | ⬜ Not started (empty template) | TBD |

> Foundation (A) known follow-up (deferred to B): add a root global-not-found so arbitrary unmatched URLs render the localized `not-found.tsx` (today it renders on explicit `notFound()` calls; unmatched URLs fall through to Next's default 404).

---

## Sprint B4.7 — Response DTO coverage (triggered by FE C0)

Triggered during customer FE Sprint C0 when `openapi-typescript-codegen` was wired to the live Swagger spec. The BE was returning Prisma model types directly (`Promise<Tour>`, `Promise<Booking>`, etc.), which Swagger renders as untyped responses — so the generated FE client had request DTOs only, no response models. Approach: add Swagger response decorators with explicit DTO classes; **do not** refactor controllers or services (decorators are pure documentation metadata — runtime path untouched).

| # | Sub-feature | Status | Postman | Docs |
| --- | --- | --- | --- | --- |
| B4.7.1 | New `src/common/dto/api-response.dto.ts` (`ApiErrorDto`, `ApiMetaDto`) | ✅ | n/a | architecture |
| B4.7.2 | Per-module response DTOs: `UserDto`, `DestinationDto` + paginated wrapper, `TourDto` + `TourWithStatsDto` + `TourDetailDto` + paginated wrapper + `ItineraryDayDto`, `DepartureDto`, `BookingDto` + `CreateBookingResponseDto`, `ReviewDto` + `PublicReviewDto` + paginated wrapper, `WishlistItemDto` | ✅ | n/a | api-overview |
| B4.7.3 | Wire `@ApiOkResponse` / `@ApiCreatedResponse` / `@ApiNoContentResponse` on all 12 customer-facing + admin controllers (25 endpoints total) | ✅ | n/a | api-overview |
| B4.7.4 | Verify: BE `pnpm test` 87/87 pass + `tsc --noEmit` clean | ✅ | n/a | n/a |
| B4.7.5 | Add `postinstall: prisma generate` to `package.json` (avoids TS2305 after `pnpm install`) | ✅ | n/a | runbooks/local-dev |
| B4.7.6 | Regenerate FE API client | ✅ | n/a | Done in `apps/web` during Customer FE Foundation (A): `pnpm --filter @tourism/web api:types` → `src/lib/api/schema.d.ts` (openapi-typescript), consumed via an `openapi-fetch` client with envelope-unwrap middleware. |

---

## Sprint B5 — Hardening + Production

> ⏸ **On hold** until customer FE + admin FE both land. Deploying BE alone forces redeploys whenever the FE finds gaps; we'd rather deploy a complete system once. See [`sprints/b4.6-figma-alignment.md`](sprints/b4.6-figma-alignment.md) § "Why pause B5". (FE now lives in `apps/web` + `apps/admin` — both empty templates, not started.)

| # | Sub-feature | Status | Postman | Docs |
| --- | --- | --- | --- | --- |
| B5.1 | Rate limiting tighter on auth + booking | ⬜ | n/a | architecture |
| B5.2 | Sentry / structured logs with request-id | ⬜ | n/a | runbooks/observability |
| B5.3 | Test coverage core services ≥ 70% | ⬜ | n/a | n/a |
| B5.4 | E2E happy-path booking | ⬜ | n/a | runbooks/e2e |
| B5.5 | Deploy Railway + Stripe prod webhook | ⬜ | staging env | runbooks/deploy |

---

## Workflow rule (from feedback memory)

For **every** sub-feature:

1. Implement code
2. Unit/integration test
3. Update `docs/postman/tourism-api.json` with new request + example response
4. Run Postman collection — all pass
5. Update this roadmap
6. Update `docs/` if architecture or runbooks changed
7. Commit `feat(<module>): <sub-feature> + Postman + docs`
