# Frontend — Customer plan

> 🇻🇳 Vietnamese version: [`../../vi/frontend/customer-plan.md`](../../vi/frontend/customer-plan.md).

Last reviewed: 2026-05-14. Status: planned, not started.

## Where the code lives

The customer FE is a **sibling repo**, not a folder inside `tourism-be-api`:

```
C:\Development\09.Projects\
├── tourism-be-api\              ← you are here (NestJS, BE-first, sprints B0–B4.6 done)
├── tourism-frontend-customer\   ← this plan covers it
└── tourism-frontend-admin\      ← planned after customer FE
```

We deliberately keep the BE docs as the single source of sprint truth — the FE repos host their own thin READMEs but the multi-repo roadmap stays here.

## What's already in the template

The repo was bootstrapped from a Next.js + shadcn template; no business code yet.

| Layer | What's wired |
| --- | --- |
| Framework | Next.js 16 (App Router) with Turbopack dev server |
| UI runtime | React 19, TypeScript 5.9 |
| Styling | Tailwind v4 (CSS-first config in `globals.css`) + `tw-animate-css` |
| Components | 55 shadcn primitives in `components/ui/` (Card, Dialog, Sheet, Tabs, Carousel, Drawer, etc.) |
| Theming | `next-themes` via `<ThemeProvider>` in root layout; press `d` to toggle dark mode |
| Pages | `/` (template placeholder), `/login`, `/signup` (forms exist but unwired) |
| Tooltips | `<TooltipProvider>` mounted globally |
| Fonts | Geist + JetBrains Mono preloaded via `next/font/google` |
| Tooling | ESLint 9 + Prettier 3 (+ `prettier-plugin-tailwindcss`) + `tsc --noEmit` |

What is **NOT** there yet (every item below lands in a sprint):

- Supabase client (`@supabase/supabase-js`, `@supabase/ssr`)
- i18n (`next-intl` middleware + `messages/{en,vi}.json`)
- Server state (`@tanstack/react-query`)
- Client state (`zustand` for ephemeral UI like the booking wizard)
- Forms (`react-hook-form` + `zod` + `@hookform/resolvers`)
- Stripe Checkout redirect helper
- Generated API client (from the BE Swagger at `/api/docs`)
- Booking pages, tour catalog, tour detail, account pages
- SEO meta (`generateMetadata`) + sitemap + robots
- Playwright E2E setup

## Architecture decisions (locked in)

These were finalised after the Figma walk-through; documenting them so the FE sprint doesn't relitigate them.

### Authentication

- **Supabase Auth** is the only identity provider. The BE never issues tokens.
- FE calls `supabase.auth.signInWithPassword` / `signUp` → gets a JWT.
- Immediately after first sign-in (or sign-up), FE calls `POST /api/v1/auth/sync` so the BE mirrors the user into its `users` table. Re-callable safely — idempotent.
- The JWT is sent as `Authorization: Bearer <token>` on every BE call. The BE verifies it via Supabase JWKS (`SupabaseJwtGuard` already wired).
- We use **Supabase SSR cookies** (`@supabase/ssr`) so server components can read the session for SEO-sensitive pages (account, bookings detail).

### Server state

- **TanStack Query** for everything that hits the BE. Each endpoint gets a typed hook.
- Cache key convention: `['tours', filters]`, `['tour', slug]`, `['booking', code]`, `['wishlist']`, `['reviews', slug]`.
- Invalidations: `wishlist toggle` → invalidate `['wishlist']`; `booking refund webhook landed` → polled by `['booking', code]` while the success page is open.

### Data fetching split

| Page | Strategy | Why |
| --- | --- | --- |
| `/` home | Server component, ISR (60s) | SEO; tour list rarely changes |
| `/tours` catalog | Server component for first paint; client-side filters via React Query | Filter UX needs fast no-reload updates |
| `/tours/[slug]` detail | Server component + ISR | SEO + share previews; tabs are client islands |
| `/checkout/success` | Client component (polls `GET /bookings/:code`) | Need to see PAID transition land in real time |
| `/account/*` | Client component, gated by middleware | Personal data — never SSR-cache |

### i18n

- `next-intl` with locale-prefixed routes: `/en/...` and `/vi/...`. Default redirect from `/` follows `Accept-Language` then falls back to `en`.
- Locale persists to `user.locale` via `PATCH /users/me` after first profile edit; SSR reads from cookie.
- Message files in `messages/en.json` + `messages/vi.json`. Keys grouped by surface (`home.hero.title`, `bookings.errors.SEATS_NOT_AVAILABLE`).

### Forms

- `react-hook-form` + `zod` schemas mirroring the BE DTOs.
- For the booking form, we *re-derive* the Zod schema from the same constraint set the BE uses (numAdults ≥ 1, contactEmail valid, etc.) — no shared package needed; the schema is small enough to keep in sync by hand.

### Stripe Checkout

1. `POST /bookings` → `{ checkoutUrl, bookingCode }`.
2. `window.location.href = checkoutUrl` (full redirect; no Stripe.js / Elements).
3. Stripe redirects back to `/checkout/success?session_id=cs_test_xxx&code=BK-XXXX` after pay.
4. The success page polls `GET /bookings/:code` until `status === 'PAID'` (max ~10s). Webhook flips the row in <2s usually.

### Styling — Figma alignment

- The shadcn defaults use a generic neutral palette. We override in `globals.css`:
  - `--primary: #EF6B4B` (coral, the CTA colour from Figma).
  - `--foreground: #15233B` (deep navy).
  - Display font: `Pinyon Script` or `Allura` (Google Fonts) for the hero scripts ("About Us", "Landscapes", "Wanderlust"). Loaded as `--font-display`.
  - Heading: `Playfair Display` for section titles.
  - Body: `Poppins` (or stick with the existing `Geist` if it reads similar enough).
- Polaroid frames, decorative shells, and illustrated service icons → static assets in `public/figma-assets/`. Compress + serve as Next.js `<Image>` for automatic responsive sizes.

## Sprint plan

Following the existing granular-commit pattern from BE sprints. Each sub-feature ships as one commit with code + tests + screenshots in `docs/frontend/screenshots/`.

### Sprint C0 — Foundation (2-3 days)

| # | Sub-feature |
| --- | --- |
| C0.1 | Install deps: `@supabase/supabase-js @supabase/ssr next-intl @tanstack/react-query zustand react-hook-form zod @hookform/resolvers openapi-typescript-codegen` |
| C0.2 | `.env.example` + env validator: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` |
| C0.3 | Folder restructure: `app/[locale]/...`; `lib/supabase/{client,server,middleware}.ts`; `lib/api/`; `lib/i18n/`; `messages/{en,vi}.json` |
| C0.4 | Root layout: `<QueryProvider>` + `<NextIntlClientProvider>` + Figma colour overrides + display font |
| C0.5 | Generate typed API client from `http://localhost:3000/api/docs-json` into `lib/api/generated/` |
| C0.6 | Locale switcher component + middleware for `/en` ↔ `/vi` routing |

### Sprint C1 — Auth + Catalog (1.5 weeks)

| # | Sub-feature |
| --- | --- |
| C1.1 | Wire login/signup forms to Supabase Auth (email/password + Google OAuth button) |
| C1.2 | Post-auth: call `POST /auth/sync`; redirect to `/` |
| C1.3 | `/` home: hero + featured tours strip (`GET /tours?featured=true&limit=6`) + services + testimonials |
| C1.4 | `/tours` catalog: filter sidebar (destination, category, price, duration) + sort tabs + pagination |
| C1.5 | `/tours/[slug]` detail: 4 tabs (Information / Tour Plan / Location / Gallery) per Figma |
| C1.6 | `/destinations/[slug]` landing |
| C1.7 | Embla carousel for tour gallery |

### Sprint C2 — Booking + Payment (1.5 weeks)

| # | Sub-feature |
| --- | --- |
| C2.1 | Booking form sticky on tour detail: departure picker + adults/children + contact info |
| C2.2 | `POST /bookings` → redirect to `checkoutUrl` |
| C2.3 | `/checkout/success` poller (booking status PENDING → PAID) |
| C2.4 | `/checkout/cancel` |
| C2.5 | `/account/bookings` list with status filter |
| C2.6 | `/account/bookings/[code]` detail |

### Sprint C3 — Reviews + Wishlist + Polish (1.5 weeks)

| # | Sub-feature |
| --- | --- |
| C3.1 | Review form on tour detail (gated by `bookings` PAID with no existing review) |
| C3.2 | Wishlist heart icon on `TourCard` + `/account/wishlist` page |
| C3.3 | `/account/profile` (full_name, phone, locale) |
| C3.4 | Vietnamese translations finalised across every surface |
| C3.5 | SEO: `generateMetadata` per page + OG tags + sitemap + robots |
| C3.6 | Performance: Lighthouse ≥ 90 on home + tour detail (mobile) |
| C3.7 | Playwright: 3 critical journeys — `browse → book → pay`, `login → sync → wishlist`, `account view bookings` |
| C3.8 | Deploy to Vercel preview (production deploy stays in Sprint B5) |

## Local development assumptions

- BE runs at `http://localhost:3000/api/v1` with `/api/docs` Swagger live.
- FE customer runs at `http://localhost:3001` (Next.js dev default + 1).
- FE admin runs at `http://localhost:3002` (planned after customer FE).
- Supabase / Stripe / Resend stay remote — no docker-compose dance. Stripe CLI tunnel keeps webhook flow working as proven in Sprint B3.

## What lives where during the FE sprint

- BE remains BE-first — schema or service changes still happen here, not in the FE repo.
- FE sprint docs (per-feature notes, screenshots, decision logs) go in `tourism-be-api/docs/{en,vi}/frontend/`.
- The FE repo gets a richer `README.md` covering local-dev quickstart only; it does not duplicate the sprint tracker.

## Risks specific to FE customer

| Risk | Mitigation |
| --- | --- |
| Vietnamese translation lag | Write English strings first with i18n keys from day one; batch-translate VI at the end of each sprint, not mid-feature |
| Stripe redirect breaks on localhost without HTTPS | Stripe Checkout works fine on http://localhost — no extra setup needed; only mention it because new devs often expect HTTPS-only |
| Booking success page polls forever if webhook misses | Cap at 15 polls @ 1s, then show "still processing — refresh in a minute" CTA. Webhook is the authoritative path |
| Card / hero hydration mismatch under SSR | Use `useEffect` for any `Date.now()` / `Math.random()` UI; keep server-rendered HTML deterministic |
| Shadcn defaults look generic | Style overrides documented in C0.4; ship a `globals.css` review at end of C1 |

## After customer FE: admin FE

Once customer FE is in a Vercel preview and the end-to-end flow works without backend changes, the admin FE follows. Plan for it lands in `frontend/admin-plan.md` at that point.

## Acceptance for the customer FE phase

- Customer can sign up, browse, filter, book, pay with test card, see PAID confirmation, leave a review, manage wishlist, and update profile — all in EN and VI, all running locally against the local BE.
- Lighthouse mobile ≥ 90 perf + ≥ 90 a11y on home + tour detail.
- 3 Playwright journeys pass headless.
- No backend changes shipped during the FE sprint (any gap → BACKLOG, not mid-sprint BE work).
