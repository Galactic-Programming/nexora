<!-- markdownlint-disable MD013 -->
<!-- MD013 (line length): reference tables and technical one-liners (URLs, SQL,
     roadmap rows) cannot wrap without breaking GFM rendering. -->

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
| Customer FE — C. Auth & Account | `apps/web` | ✅ Complete — C1 Core Auth → C1.5 layout → C2 Account profile → C3 Google OAuth → C4 2FA TOTP all done | see C1–C4 below |
| Customer FE — C1. Core Auth | `apps/web` | ✅ Done on `feat/customer-fe-auth-core` (Supabase email/password: sign-in/up(+verify)/forgot/reset/sign-out; `/auth/callback` code exchange → `POST /auth/sync`; `returnTo` sanitized + hard-nav post-auth; `(auth)` route group + signed-in guard; UserMenu avatar dropdown; shadcn-studio auth blocks; EN/VI; 77 web tests). Seams: Google button inert (C3), `/account` link (C2), sign-in AAL (C4). | [specs/2026-06-08-customer-fe-auth-core-design.md](../superpowers/specs/2026-06-08-customer-fe-auth-core-design.md), [plans/2026-06-08-customer-fe-auth-core.md](../superpowers/plans/2026-06-08-customer-fe-auth-core.md) |
| Customer FE — C1.5. Auth layout polish | `apps/web` | ✅ Done on `feat/customer-fe-auth-layout-polish` (auth pages → chrome-free full-screen split: `(site)` route group carries SiteHeader/Footer, `(auth)` wraps pages in `AuthShell` + `AuthBrandPanel` (image + brand-tint + tagline), slim `AuthCard`; mobile collapses to single column; theme tokens only — no hex; auth logic untouched; URLs unchanged; 77 web tests). | [specs/2026-06-09-customer-fe-auth-layout-polish-design.md](../superpowers/specs/2026-06-09-customer-fe-auth-layout-polish-design.md), [plans/2026-06-09-customer-fe-auth-layout-polish.md](../superpowers/plans/2026-06-09-customer-fe-auth-layout-polish.md) |
| Customer FE — C2. Account profile | `apps/web` | ✅ Done on `feat/customer-fe-account-profile` (RSC `/account`: reverse guard → `sign-in?returnTo=/account`, auto-sync + `getMe` w/ USER_NOT_SYNCED retry, read-only `IdentityBlock`, RHF+zod `ProfileForm` editing fullName/phone/locale via `PATCH /users/me` w/ diff/omit body-builder + `updateProfile` server action (re-validates, no-op on empty, locale-safe `revalidatePath`); thin `AccountShell` scaffold; EN/VI; theme tokens only; TDD on logic — 101 web tests). Wires C1 UserMenu → `/account` seam. | [specs/2026-06-11-customer-fe-account-profile-design.md](../superpowers/specs/2026-06-11-customer-fe-account-profile-design.md), [plans/2026-06-11-customer-fe-account-profile.md](../superpowers/plans/2026-06-11-customer-fe-account-profile.md) |
| Customer FE — C3. Google OAuth | `apps/web` | ✅ Done on `feat/customer-fe-google-oauth` (live `GoogleButton` → `signInWithOAuth` w/ PKCE through the existing `/auth/callback`; `next=/{locale}{returnTo}` preserves locale + destination; dedicated `?error=oauth` flag + locale-aware error bounces via `pathLocale`; fixed C1 gap — sign-in now renders callback error flags (`link`/`oauth`) via `mapCallbackError`; TDD on `buildOAuthRedirect`/`pathLocale`/`mapCallbackError` — 109 web tests; e2e verified w/ real Google: sign-in EN/VI, returnTo→/account, user mirrored CUSTOMER). Config: Google Cloud OAuth client + Supabase Google provider + localhost callback allow-listed (prod URL pending deploy). | [specs/2026-06-11-customer-fe-google-oauth-design.md](../superpowers/specs/2026-06-11-customer-fe-google-oauth-design.md), [plans/2026-06-11-customer-fe-google-oauth.md](../superpowers/plans/2026-06-11-customer-fe-google-oauth.md) |
| Customer FE — C4. 2FA TOTP | `apps/web` | ✅ Done on `feat/customer-fe-2fa-totp` (`/account/security` w/ AccountShell 2-item nav: enroll TOTP (QR + secret + code verify, stale-factor cleanup, cancel unenrolls) + code-gated removal (challenge+verify→aal2 even for OAuth sessions); sign-in two-step AAL step-up via `shouldChallengeMfa`/`pickTotpFactor` — Google OAuth not challenged by design; fixed `mapAuthError` mis-mapping TOTP errors to linkInvalid; EN/VI; 118 web tests; e2e w/ programmatic RFC-6238 codes incl. wrong-code paths). Phase C complete. | [specs/2026-06-11-customer-fe-2fa-totp-design.md](../superpowers/specs/2026-06-11-customer-fe-2fa-totp-design.md), [plans/2026-06-11-customer-fe-2fa-totp.md](../superpowers/plans/2026-06-11-customer-fe-2fa-totp.md) |
| Customer FE — D. Booking & Review | `apps/web` | 🔄 In progress — D1 Booking flow + D2 My bookings done; D3 Write review pending | see D1–D2 below |
| Customer FE — D1. Booking flow | `apps/web` | ✅ Done on `feat/customer-fe-booking-flow` (signed-in checkout: RSC `/tours/[slug]/book?departure=<id>` reverse-guard → `sign-in?returnTo=` w/ slug+departure intact, C2 profile prefill, departure preselect; RHF+zod `BookingForm` (radiogroup departures, sold-out disabled, live total, PhoneInput) → `createBooking` server action → `POST /bookings` → Stripe Checkout redirect (bookingCode in sessionStorage); `/checkout/success` polls `getBookingStatus` PENDING→PAID (2s interval, 30s timeout fallback, key cleared on PAID) → confirmed panel; `/checkout/cancel` panel; `BookingSidebar` per-departure Book links. Backend untouched. EN/VI parity (44 keys); theme tokens only; TDD on pure logic — 146 web tests; full browser e2e (7 scenarios + seat increment + console-clean) via self-signed webhook harness). | [specs/2026-06-13-customer-fe-booking-flow-design.md](../superpowers/specs/2026-06-13-customer-fe-booking-flow-design.md), [plans/2026-06-13-customer-fe-booking-flow.md](../superpowers/plans/2026-06-13-customer-fe-booking-flow.md) |
| Customer FE — D2. My bookings | `apps/web` | ✅ Done on `feat/customer-fe-my-bookings` (RSC `/account/bookings` list + `/account/bookings/[code]` detail, both reverse-guarded; `getMyBookings` typed helper over `GET /bookings/me` top-50; `BookingsList`/`BookingRow`/`BookingStatusBadge`/`BookingDetail` presentational; status→tone+label, locale-aware date range, 50-cap note; AccountShell gains 3rd nav tab; detail 404→`notFound()` (owner-scoping inherited); list shows real error state, not fake-empty. **Backend pure-doc only:** `BookingDto` now documents the `tour`+`departure` join (B4.7-style `@ApiProperty` DTOs) so the FE client is typed — no controller/service change. Closes D1 seam: success panel deep-links to `/account/bookings/<code>`. EN/VI parity; theme tokens only; TDD on pure logic — 173 web tests, api 125; full browser e2e (6 scenarios, all 4 statuses, console-clean). | [specs/2026-06-14-customer-fe-my-bookings-design.md](../superpowers/specs/2026-06-14-customer-fe-my-bookings-design.md), [plans/2026-06-14-customer-fe-my-bookings.md](../superpowers/plans/2026-06-14-customer-fe-my-bookings.md) |
| Admin FE | `apps/admin` | ⬜ Not started (empty template) | TBD |

> Foundation (A) known follow-up (deferred to B): add a root global-not-found so arbitrary unmatched URLs render the localized `not-found.tsx` (today it renders on explicit `notFound()` calls; unmatched URLs fall through to Next's default 404).

## Adjustment phase — post-Phase-C hardening (2026-06-12 → 13) ✅

Three audit/hardening passes between Phase C and Phase D, driven by a full
review of the function catalogs ([functions-customer.md](../reference/functions-customer.md),
[functions-admin.md](../reference/functions-admin.md) — both now carry a
per-function **Trạng thái** column).

| # | Pass | Shipped |
| --- | --- | --- |
| 1 | Schema hardening | 28 `@db.VarChar` caps mirroring DTO bounds 1:1; `MediaRole` enum; `CHECK reviews.rating 1..5`; `REVOKE` `rls_auto_enable()` from anon/authenticated **and PUBLIC**; 🐛 booking codes were base64url (`-`/`_` broke the review regex for ~22% of bookings) → true base36 `mintBookingCode()` |
| 2 | Customer functions (U-01→U-17) | `DEPARTURE_DEPARTED` (no booking past departures; UTC calendar compare); webhook `processed_at` idempotency (crashed events re-process on retry — payments can't be lost); orphan PENDING cleanup on Stripe session failure |
| 3 | Admin functions (A-01→A-22) | Slug auto-normalize/generate (`slugify()`, slug optional, `INVALID_SLUG`); `DEPARTURE_IN_PAST` typo guard; **two-tier delete** (`TOUR_IS_PUBLISHED`/`DESTINATION_IS_ACTIVE` — hide before hard delete; FK Restrict = tier 3); refund converges on `charge_already_refunded` + audit columns `refund_reason`/`refunded_by` |

Deferred with owners noted in the catalogs (🕒): `costPrice` profit stats
(needs business decision), `/bookings/me` pagination (Phase D), phone
clear-to-null parity, itinerary-vs-duration publish check, CANCELLED-departure
refund flow, moderation audit columns, partial refunds, multi-currency
revenue, leaked-password protection (Supabase Pro plan).

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
