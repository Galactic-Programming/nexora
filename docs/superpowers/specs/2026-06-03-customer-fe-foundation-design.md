# Customer FE — Foundation (A) — Design Spec

**Date:** 2026-06-03
**Branch:** `feat/customer-fe-foundation`
**App:** `apps/web` (customer, Next.js 16 App Router, port 3001)
**Status:** Approved (design), pending implementation plan

> This is the first of four sub-projects for the customer frontend:
> **A. Foundation** → B. Browse → C. Auth & Account → D. Booking & Review.
> Each sub-project ships on its own feature branch and merges to `master` when done.

---

## 1. Goal & Scope

Stand up the data + auth + layout foundation for `apps/web`, plus **one real Home page**
that fetches featured tours from the backend, proving the data flow works end-to-end.

**In scope (branch A):**

- API client generated from the backend Swagger spec (`openapi-fetch` + `openapi-typescript`)
- Envelope-aware fetch wrapper + typed `ApiError`
- Supabase auth wiring via `@supabase/ssr` (cookie sessions, middleware refresh) — **infra only, no login form**
- Layout shell: header, main nav, mobile nav, user menu, footer (reusing `@tourism/ui`)
- Error / loading / not-found patterns
- Typed env config with fail-fast validation
- TanStack Query provider (used heavily in C/D; a minimal example in A)
- Home page with a real `featured-tours` server component
- Unit tests (Vitest + RTL), ≥80% coverage on new code

**Out of scope (deferred):**

- Tours list with filter/sort/pagination, destinations, tour detail → **phase B**
- Sign in / sign up / reset / verify / 2FA UI, profile, my bookings, wishlist → **phase C**
- Booking flow + Stripe redirect, write review → **phase D**
- E2E Playwright suite (a single "home loads" smoke test may be added later)

---

## 2. Architecture & Directory Layout (`apps/web/src/`)

```text
lib/
  env.ts                 # validate env with zod, fail-fast at boot
  api/
    schema.d.ts          # GENERATED from Swagger (openapi-typescript) — do not edit
    client.ts            # openapi-fetch factory (server + browser variants)
    fetch.ts             # unwrap envelope {data,error,meta}, throw ApiError
    errors.ts            # class ApiError { code, message, status }
  supabase/
    server.ts            # createServerClient (reads cookies)
    client.ts            # createBrowserClient
    middleware.ts        # session refresh helper
providers/
  query-provider.tsx     # TanStack QueryClientProvider (client component)
components/layout/
  site-header.tsx, main-nav.tsx, mobile-nav.tsx,
  user-menu.tsx, site-footer.tsx
features/home/
  hero.tsx
  featured-tours.tsx     # RSC: real fetch of GET /tours?featured=true
app/[locale]/
  layout.tsx             # + header/footer + QueryProvider
  page.tsx               # Home
  loading.tsx, error.tsx, not-found.tsx
proxy.ts                 # existing i18n middleware + Supabase session refresh
```

Rationale: feature-first folders (`features/home`) for page-specific composition; shared
primitives stay in `@tourism/ui`; cross-cutting infra under `lib/`.

---

## 3. Data Flow

The backend returns a consistent envelope `{ data, error, meta }`.

- `fetch.ts` unwraps `data`; if `error` is present it throws `ApiError { code, message, status }`.
- **Public data (RSC):** `featured-tours.tsx` is a Server Component calling
  `GET /tours?featured=true` through the server client — no token required → good SEO.
- **Auth data / mutations (client):** the browser client attaches the Supabase session
  Bearer token and is wrapped in TanStack Query. Used from phases C/D; phase A only
  stands up the provider plus a small example (`user-menu` reads session state).
- **Codegen:** `pnpm api:types` =
  `openapi-typescript http://localhost:3000/api/docs-json -o src/lib/api/schema.d.ts`.
  Run against a locally running backend; commit the generated `schema.d.ts`.

---

## 4. Auth (`@supabase/ssr`)

Sessions are stored in cookies and refreshed in middleware (composed into `proxy.ts`
alongside next-intl). Server Components read the session via `supabase/server.ts`.
`user-menu.tsx` shows "Sign in" or an avatar depending on session presence.
No login form in phase A — only the infra and the mount points for phase C.

---

## 5. Env Config

Required public vars, validated in `lib/env.ts` (zod), with a matching `.env.example`:

- `NEXT_PUBLIC_API_BASE_URL` (e.g. `http://localhost:3000/api/v1`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Validation fails fast at module load with a clear message listing missing vars.

---

## 6. Error / Loading

- `ApiError` surfaces to `app/[locale]/error.tsx` (route error boundary).
- 404 → `app/[locale]/not-found.tsx`.
- `loading.tsx` uses the existing `shimmer-skeleton` from `@tourism/ui`.
- Client mutations report failures with `sonner` toasts.

---

## 7. Testing

Vitest + React Testing Library:

- `fetch.ts` — unwraps envelope on success; throws `ApiError` with correct code/status on error.
- `env.ts` — passes with valid env; throws listing missing vars otherwise.
- `featured-tours.tsx` — renders tour cards from a mocked fetch; renders an empty state on `[]`.

Target ≥80% coverage on new code. Playwright deferred.

---

## 8. New Dependencies (`apps/web`)

Runtime: `@supabase/ssr`, `@supabase/supabase-js`, `@tanstack/react-query`, `openapi-fetch`.
Dev: `openapi-typescript`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`,
`@vitejs/plugin-react`, `jsdom`.

---

## 9. Verification (Definition of Done for branch A)

1. `pnpm --filter @tourism/web typecheck` clean.
2. `pnpm --filter @tourism/web lint` clean.
3. `pnpm --filter @tourism/web test` green, ≥80% on new code.
4. `pnpm --filter @tourism/web dev` → Home renders real featured tours from a running backend;
   header/footer/locale switcher work; `user-menu` reflects logged-out state.
5. `pnpm api:types` regenerates `schema.d.ts` without manual edits.
