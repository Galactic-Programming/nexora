# Customer FE — Booking Flow (D1) — Design Spec

**Date:** 2026-06-13
**Branch:** `feat/customer-fe-booking-flow`
**App:** `apps/web` (customer, Next.js 16 App Router, port 3001)
**Status:** Approved (design), pending implementation plan

> First sub-phase of Phase D (D1 booking → D2 my-bookings → D3 review, each on
> its own branch). Turns the deliberately-disabled `BookingSidebar` "Book now"
> CTA (B2 seam) into the full purchase loop: booking form →
> `POST /bookings` → Stripe Checkout redirect → success/cancel pages with
> webhook-aware status polling. **Backend is unchanged** — it already ships
> server-side pricing, `DEPARTURE_DEPARTED`/seat guards, orphan compensation,
> and two-way webhook idempotency (the 2026-06-12 hardening passes).
> Layout-first ([[fe-layout-first-redesign-later]]): theme tokens only, reuse
> `@tourism/ui`, polish deferred.

---

## 1. Goal & Scope

A signed-in customer picks a departure on the tour page, fills one booking
form, pays on Stripe-hosted Checkout, and lands back on a success page that
reflects the webhook-confirmed `PAID` state.

**Brainstorm decisions (locked):**

- **Phase split:** D1 only. D2 (`/account/bookings` + `/bookings/me`
  pagination) and D3 (write review) follow on separate branches/specs.
- **Booking form is a dedicated page** `/tours/[slug]/book?departure=<id>` —
  shareable URL, natural `returnTo` round-trip for signed-out users.
- **`bookingCode` travels via `sessionStorage`** — Stripe's success URL only
  carries `{CHECKOUT_SESSION_ID}` (fixed server-side), and the backend was
  designed for the FE to keep the code and poll `GET /bookings/:code`.
- **E2E:** Playwright completes Stripe test Checkout (4242 card); the
  PENDING→PAID transition is driven deterministically by the existing
  self-signed webhook harness (same one the 107-assertion newman suite uses) —
  no dependency on `stripe listen`.

**In scope:**

- New route `app/[locale]/(site)/tours/[slug]/book/page.tsx` (+ `loading.tsx`)
  with reverse guard + server-side load (tour, departures, profile prefill).
- `features/booking/`: `BookingForm` (client, RHF+zod), pure helpers
  (`computeTotal`, `seatsLeft` reuse check, `mapBookingError`), server actions
  `createBooking` + `getBookingStatus`, poll state machine `nextPollState`.
- New routes `app/[locale]/(site)/checkout/success/page.tsx` and
  `checkout/cancel/page.tsx` (+ client status components).
- `BookingSidebar` seam flip: per-departure "Book" links (tests updated).
- `lib/api/bookings.ts` typed helpers (`createBooking`, `getBookingByCode`).
- i18n namespace `Booking` (EN/VI).
- Tests: TDD for all logic; browser + Stripe-test e2e.

**Out of scope (deferred):**

- D2 `/account/bookings` (success page links home until it exists), D3 review.
- Backend changes of any kind (incl. `/bookings/me` pagination — that is D2).
- Per-pixel polish / redesign pass; booking for guests without an account.

---

## 2. Booking page — `/tours/[slug]/book`

### 2.1 RSC (`page.tsx`)

1. `await params` (`locale`, `slug`), `setRequestLocale`.
2. **Reverse guard** (same pattern as `/account`): `getUser()`; signed-out →
   `redirect({ href: { pathname: "/sign-in", query: { returnTo:
   "/tours/<slug>/book?departure=<id>" } }, locale })` — `sanitizeReturnTo`
   already allows query strings, and sign-in hard-navs back after auth.
3. `await syncUser()` then server-side loads in parallel (`Promise.all`):
   - tour by slug (published; 404 → `notFound()`),
   - public departures (`GET /tours/:slug/departures` — defaults OPEN +
     from=today),
   - `getMe(token)` for contact prefill (fullName/email/phone).
4. Render `BookingForm` with `{ tour, departures, profile, preselectId }`
   where `preselectId` = `?departure` when it matches a listed departure
   (silently ignored otherwise).
5. Edge: zero departures → render the empty state with a back-to-tour link
   (no form).

### 2.2 `BookingForm` (client)

RHF + zod (`bookingSchema` mirrors `CreateBookingDto`):

- `departureId` — radio/select rows: date range, effective unit price
  (`priceOverride ?? basePrice`), seats left; required.
- `numAdults` int 1–20; `numChildren` int 0–20 (default 0).
- `contactName` ≤120 (required), `contactEmail` email ≤200 (required),
  `contactPhone` optional 6–30, `specialRequests` optional ≤1000.
- Prefill: `contactName ← profile.fullName`, `contactEmail ← profile.email`,
  `contactPhone ← profile.phone` — all editable (booking on someone's behalf).
- Display-only total: `computeTotal(unitPrice, adults, children)` recomputed
  live; labelled as estimate — **the server is authoritative** (existing
  backend behaviour, restated in copy).
- Submit → `createBooking` server action. On `{ ok: true }`: write
  `sessionStorage["booking:lastCode"] = bookingCode`, then
  `window.location.assign(checkoutUrl)`. On `{ ok: false, code }`: inline
  alert via `mapBookingError(code)` (codes: `DEPARTURE_DEPARTED`,
  `DEPARTURE_NOT_OPEN`, `SEATS_NOT_AVAILABLE`, `TOUR_NOT_FOUND`,
  `DEPARTURE_NOT_FOUND`, fallback generic), button re-enabled.

### 2.3 Server action `createBooking` (features/booking/actions.ts)

Pattern copied from C2 `updateProfile`: `"use server"`, session token read
server-side, re-validate with `bookingSchema.safeParse`, call
`POST /bookings` via the typed client, map `ApiError.code` into a typed
result `{ ok: true, bookingCode, checkoutUrl } | { ok: false, code: BookingErrorCode }`.
No token ever reaches the client bundle.

---

## 3. Checkout result pages

Both live in `(site)` (header/footer chrome). The backend pins the
non-localized paths `frontendUrl + /checkout/success|cancel`; next-intl
middleware locale-prefixes on arrival (query preserved).

### 3.1 `/checkout/success?session_id=…`

Client component drives a poll loop over the `getBookingStatus(code)` server
action (token server-side, `GET /bookings/:code`, returns
`{ ok: true, status, booking } | { ok: false }`):

- Read `sessionStorage["booking:lastCode"]`. Missing (new tab, cleared
  storage) → render the fallback panel: "payment received — check your
  account shortly" + home link (→ `/account/bookings` once D2 lands).
- Poll driven by pure state machine `nextPollState(prev, result, elapsed)`
  (TDD): `PENDING` → keep polling every 2s up to 30s → `timeout` state
  ("still processing — check back in your account"); `PAID` → success panel
  (code, tour title, dates, total, seats) + clear the storage key;
  `CANCELLED`/`REFUNDED` → expired/refunded panel; action error → retry once
  then fallback panel.

### 3.2 `/checkout/cancel?code=…`

Static panel: payment not completed, the booking auto-cancels ~30 min via
Stripe session expiry (webhook), nothing was charged. CTA back to the tour
page (slug not in the URL — link to `/tours` listing; acceptable for D1) and
"try again".

---

## 4. `BookingSidebar` seam flip

Each departure row gains a "Book" `Link` →
`/tours/<slug>/book?departure=<id>` (replaces the single disabled button).
Component gains `slug` prop from `TourDetail`. The B2 test asserting the
disabled CTA is replaced with link-href assertions. Empty state unchanged.

---

## 5. i18n — namespace `Booking` (EN/VI)

`form.*` (title, departureLabel, adults, children, contactName, contactEmail,
contactPhone, specialRequests, total, totalNote, submit, submitting,
seatsLeft, empty, backToTour), `errors.*` (departureDeparted,
departureNotOpen, seatsNotAvailable, notFound, generic),
`success.*` (processing, paidTitle, paidBody, code, timeout, missingCode,
expired, refunded, backHome), `cancel.*` (title, body, retry). Exact copy at
implementation; EN/VI parity enforced.

---

## 6. Testing

**TDD (pure logic):** `bookingSchema` bounds; `computeTotal` (Decimal-string
unit price × seats, children additive); `mapBookingError` code→key map;
`createBooking`/`getBookingStatus` result mapping (mock client like C2
`actions.test.ts`); `nextPollState` (pending→poll, paid→done, timeout at 30s,
error→retry-once).

**Browser e2e (Playwright):**

1. Signed-out `/tours/<slug>/book` → sign-in returnTo round-trip (query
   intact).
2. Form prefilled from profile; pick departure; invalid inputs rejected
   client-side; submit → Stripe Checkout page reached (test mode).
3. Complete payment with `4242 4242 4242 4242` → redirected to
   `/checkout/success` → shows "processing" while PENDING.
4. Fire the **self-signed webhook harness** for the session → poll flips to
   PAID panel; booking row PAID in DB.
5. Cancel path: abandon checkout → `/checkout/cancel?code=` renders.
6. Error path: book a departure then mark it CLOSED via admin API → second
   submit shows `departureNotOpen` message.
7. EN + VI passes; console clean.

Suites: `pnpm --filter @tourism/web test` (target ≥ existing 118 + new),
typecheck/lint/build, api suite untouched (no backend change).

---

## 7. Files (planned)

**New:**

- `apps/web/src/app/[locale]/(site)/tours/[slug]/book/page.tsx` + `loading.tsx`
- `apps/web/src/app/[locale]/(site)/checkout/success/page.tsx`
- `apps/web/src/app/[locale]/(site)/checkout/cancel/page.tsx`
- `apps/web/src/features/booking/booking-form.tsx`
- `apps/web/src/features/booking/schema.ts` (+ test)
- `apps/web/src/features/booking/pricing.ts` (`computeTotal`) (+ test)
- `apps/web/src/features/booking/booking-error.ts` (`mapBookingError`) (+ test)
- `apps/web/src/features/booking/actions.ts` (+ test)
- `apps/web/src/features/booking/poll.ts` (`nextPollState`) (+ test)
- `apps/web/src/features/booking/checkout-status.tsx` (client poll UI)
- `apps/web/src/lib/api/bookings.ts` (+ test)

**Modified:**

- `apps/web/src/features/tour-detail/booking-sidebar.tsx` (+ its test)
- `apps/web/src/features/tour-detail/tour-detail.tsx` (pass `slug`)
- `apps/web/messages/en.json`, `vi.json` (`Booking` namespace)
- `docs/planning/roadmap.md` (mark D1 at the end)

**Unchanged (reused seams):** `lib/supabase/server`, `lib/api/client` +
`users.ts` (`getMe`), `features/auth/actions` (`syncUser`),
`sanitizeReturnTo`, postman webhook harness.

---

## 8. Risks / notes

- **Webhook latency UX** is the whole point of the poll loop — local dev
  without a webhook deliverer keeps bookings PENDING; the success page's
  timeout copy covers it, and the harness closes the loop in e2e.
- **sessionStorage loss** (new tab / privacy mode) degrades gracefully to the
  fallback panel — money is never at risk; the webhook settles the booking
  regardless of what the success page shows.
- `cancelUrl` carries the code but D1's cancel page has no tour slug — CTA
  goes to the tours listing; D2's booking detail will deep-link properly.
- Stripe Checkout in Playwright test mode is normally automatable; if Stripe
  blocks the automated browser, fall back to harness-only e2e for the
  payment leg (form→Stripe-page reach still asserted in-browser).
- Dev servers: kill stale 3000/3001 on EADDRINUSE; clear `apps/web/.next`
  after branch switches.
