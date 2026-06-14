# Customer FE — My Bookings (D2) — Design Spec

**Date:** 2026-06-14
**Branch:** `feat/customer-fe-my-bookings`
**App:** `apps/web` (customer, Next.js 16 App Router, port 3001)
**Status:** Approved (design), pending implementation plan

> Second sub-phase of Phase D (D1 booking ✅ → **D2 my-bookings** → D3 review,
> each on its own branch). Gives a signed-in customer a place to see every
> booking they've made and re-open any one of them. Closes the D1 seam where
> `/checkout/success` and `/checkout/cancel` link "home" because
> `/account/bookings` didn't exist yet. Layout-first
> ([[fe-layout-first-redesign-later]]): theme tokens only, reuse `@tourism/ui`,
> polish deferred.

---

## 1. Goal & Scope

A signed-in customer opens **Account → My bookings**, sees their bookings
newest-first with status, tour, dates, seats and total, and clicks any row to
a **detail page** that re-renders the full booking (the same confirmation
information the post-checkout success panel shows, available any time).

**Brainstorm decisions (locked):**

- **Typed join via Swagger DTO decorators (B4.7-style).** The backend already
  joins `tour {slug, titleEn, titleVi}` + `departure {startDate, endDate}` on
  `GET /bookings/me` and additionally `departure.status` on
  `GET /bookings/:code` at runtime, but `BookingDto`'s Swagger schema doesn't
  declare those nested fields — so the generated FE client can't see them.
  Fix exactly like Sprint B4.7: add nested `@ApiProperty` DTO classes
  (`BookingTourSummaryDto`, `BookingDepartureSummaryDto`) to `BookingDto`,
  regenerate `apps/web/src/lib/api/schema.d.ts`. **Pure documentation
  metadata — runtime/services/controllers untouched.** This is the only
  backend-touching change and it adds zero behaviour.
- **Scope = list + detail.** `/account/bookings` (list) **and**
  `/account/bookings/[code]` (detail via existing `GET /bookings/:code`).
- **No pagination.** `GET /bookings/me` returns the caller's **top 50 newest**
  bookings (flat array, capped server-side — confirmed in
  `bookings.service.ts findOwnList`). 50 is an ample cap for a customer's own
  history; real pagination stays deferred (the backend comment already plans
  for it "if `/account/bookings` ever needs more"). The list renders all
  returned rows; an honest note appears only if exactly 50 come back.
- **AccountShell gains a third nav item.** It was explicitly built for this
  ("Structured so Phase D (e.g. Bookings) can append nav items"). The
  `AccountSection` union extends to `"bookings"`.

**In scope:**

- BE (pure-doc): `BookingTourSummaryDto` + `BookingDepartureSummaryDto`, wire
  nested `tour`/`departure` onto `BookingDto`; regenerate FE schema; api suite
  stays green (no logic touched).
- New route `app/[locale]/(site)/account/bookings/page.tsx` (+ `loading.tsx`):
  reverse guard → list.
- New route `app/[locale]/(site)/account/bookings/[code]/page.tsx`
  (+ `loading.tsx`): reverse guard → detail; `notFound()` on
  `BOOKING_NOT_FOUND`.
- `features/bookings-list/`: presentational `BookingsList` + `BookingRow` +
  `BookingStatusBadge` + `BookingDetail`, pure helpers
  (`formatBookingSummary`, `mapBookingStatus`, `bookingDateRange`).
- `lib/api/bookings.ts`: add `getMyBookings(token)` typed helper.
- `AccountShell`: extend nav (`"bookings"` section + `/account/bookings`).
- i18n namespace `Bookings` (list/detail/status) EN/VI.
- D1 seam close: success-page home link + cancel-page CTA now point at
  `/account/bookings` (success) where it makes sense.
- Tests: TDD for all pure helpers; browser e2e (list + detail, EN/VI).

**Out of scope (deferred):**

- D3 write-review (the detail page leaves a seam: a "Write a review" affordance
  on PAID bookings is **inert/absent** until D3).
- Real server-side pagination of `/bookings/me`.
- Cancel-my-booking / self-service refund (admin-only surface; not a customer
  capability in this system).
- Per-pixel polish / redesign pass.

---

## 2. Backend — typed join (pure-doc, B4.7-style)

`apps/api/src/modules/bookings/dto/booking.dto.ts`:

```ts
export class BookingTourSummaryDto {
  @ApiProperty({ example: 'sa-pa-trek-2d1n' }) slug!: string;
  @ApiProperty() titleEn!: string;
  @ApiProperty() titleVi!: string;
}
export class BookingDepartureSummaryDto {
  @ApiProperty({ format: 'date-time' }) startDate!: string;
  @ApiProperty({ format: 'date-time' }) endDate!: string;
  // present on GET /bookings/:code, omitted on GET /bookings/me
  @ApiProperty({ required: false, enum: [...], example: 'OPEN' })
  status?: DepartureStatus;
}
```

Add to `BookingDto`:

```ts
@ApiProperty({ type: BookingTourSummaryDto }) tour!: BookingTourSummaryDto;
@ApiProperty({ type: BookingDepartureSummaryDto })
departure!: BookingDepartureSummaryDto;
```

- `departure.status` is declared `required: false` because `findOwnList`
  selects only `{startDate,endDate}` while `findByCodeForCaller` adds `status`.
  Generated FE type → `status?: ...`. The detail page reads it; the list
  doesn't.
- No controller/service edits. `findOwnList` + `findByCodeForCaller` already
  return exactly this shape; we are only describing it for Swagger.
- Regenerate: `pnpm --filter @tourism/web api:types` (api running) →
  `src/lib/api/schema.d.ts`. Verify `BookingDto.tour` / `.departure` typed.
- Gate: `pnpm --filter @tourism/api test` stays green (87/87 — decorators are
  inert at runtime), `tsc --noEmit` clean both apps.

---

## 3. List — `/account/bookings`

### 3.1 RSC (`page.tsx`)

1. `await params` (`locale`), `setRequestLocale`.
2. **Reverse guard** (same as `/account`): `getUser()`; signed-out →
   `redirect({ href: { pathname: "/sign-in", query: { returnTo:
   "/account/bookings" } }, locale })`.
3. `await syncUser()`; read token from session; `getMyBookings(token)` inside
   `try` (USER_NOT_SYNCED retry once, mirroring `/account` `loadProfile`).
4. Render inside `AccountShell active="bookings"`:
   - zero bookings → empty state (copy + "Browse tours" link to `/tours`).
   - otherwise → `BookingsList` of `BookingRow`s, newest-first (already
     ordered by the API).
   - if exactly 50 rows → a muted "showing your 50 most recent" note.

### 3.2 `BookingsList` / `BookingRow` (presentational, server components)

Each row is a `Link` → `/account/bookings/<code>` showing:

- `BookingStatusBadge` (status → tone: PAID=positive, PENDING=neutral/amber,
  CANCELLED=muted, REFUNDED=muted/info).
- Tour title (locale-picked: `locale==='vi' ? titleVi : titleEn`).
- Departure date range (`bookingDateRange(startDate,endDate,locale)`).
- Seats summary (`numAdults`/`numChildren` via ICU) + total
  (`totalAmount` + `currency`).
- `code` (muted, mono).

No client JS needed — pure server render + `Link`.

---

## 4. Detail — `/account/bookings/[code]`

### 4.1 RSC (`page.tsx`)

1. `await params` (`locale`, `code`), `setRequestLocale`.
2. Reverse guard → `returnTo: "/account/bookings/<code>"`.
3. `syncUser()`; `getBookingByCode(token, code)` in `try`; on `ApiError`
   `BOOKING_NOT_FOUND` (or any 404) → `notFound()`. (The backend already
   collapses not-owned into `BOOKING_NOT_FOUND`, so a customer can never read
   someone else's booking — the FE inherits that.)
4. Render `AccountShell active="bookings"` → `BookingDetail`.

### 4.2 `BookingDetail` (presentational)

- Back link → `/account/bookings`.
- Header: tour title + `BookingStatusBadge` + `code`.
- `<dl>` blocks: departure date range; seats (`numAdults`+`numChildren`);
  total paid (`totalAmount`+`currency`); contact (name/email/phone);
  `specialRequests` when present; `paidAt`/`cancelledAt` when present.
- Status-aware helper line (mirrors success/cancel copy): PAID → "confirmed,
  confirmation emailed"; PENDING → "awaiting payment confirmation"; CANCELLED
  → "this booking was cancelled"; REFUNDED → "this booking was refunded".
- A link to the tour page (`/tours/<slug>`) using the joined `tour.slug`.
- **D3 seam:** a "Write a review" affordance is intentionally absent/inert on
  PAID bookings until D3 wires it (documented, not rendered).

---

## 5. `lib/api/bookings.ts` — `getMyBookings`

```ts
export type MyBooking = components["schemas"]["BookingDto"]; // now joined
export async function getMyBookings(token: string): Promise<MyBooking[]> {
  const { data } = await createApiClient(token).GET("/api/v1/bookings/me");
  if (!data) throw new ApiError("EMPTY", "Empty /bookings/me response", 200);
  return data;
}
```

Mirrors existing `getBookingByCode`. `getBookingByCode` already returns the
now-richer `BookingDto` (gains `.tour`/`.departure` typing for free after the
schema regen — no signature change).

---

## 6. Pure helpers (TDD) — `features/bookings-list/`

- `mapBookingStatus(status) → { labelKey, tone }` — status → i18n key + badge
  tone (`positive|neutral|muted|info`). Exhaustive switch over the 4 statuses.
- `bookingDateRange(startISO, endISO, locale) → string` — reuse the same
  `Intl.DateTimeFormat` approach used by `toDepartureModel`/BookingForm rows
  (extract/share if already centralised; otherwise a small local formatter
  with EN/VI locale tags). Pure, deterministic given a fixed locale.
- `pickTourTitle(tour, locale) → string` — `locale==='vi' ? titleVi : titleEn`
  (shared with detail; trivial but tested for the locale branch).
- `isTruncatedList(rows) → boolean` — `rows.length === 50` (the 50-cap note).

All pure, no I/O — unit tested like D1's `pricing.ts`/`poll.ts`.

---

## 7. i18n — namespace `Bookings` (EN/VI)

- `list.*`: title, subtitle, empty, browseTours, truncatedNote, seats (ICU
  `{adults}/{children}`), total.
- `detail.*`: back, departure, seats, totalPaid, contact, name, email, phone,
  specialRequests, paidAt, cancelledAt, viewTour, notFoundTitle.
- `status.*`: paid, pending, cancelled, refunded (badge labels) + `note.paid`,
  `note.pending`, `note.cancelled`, `note.refunded` (helper lines).
- `nav.bookings` added to the existing `Account` namespace (AccountShell tab).

Exact copy at implementation; **EN/VI key parity enforced** (node parity check
like D1).

---

## 8. Testing

**TDD (pure helpers):** `mapBookingStatus` (all 4 → correct key+tone),
`bookingDateRange` (EN vs VI formatting, same-day vs multi-day),
`pickTourTitle` (locale branch), `isTruncatedList` (49/50/51).

**Component (RTL, light):** `BookingStatusBadge` renders tone class +
label; `BookingRow` links to `/account/bookings/<code>` and shows title/dates;
`BookingDetail` shows contact + status note, hides `specialRequests` when
absent. (Mock `@/i18n/navigation` Link as `<a>`, like D1 sidebar test.)

**Browser e2e (Playwright):**

1. Signed-out `/account/bookings` → sign-in `returnTo` round-trip (then lands
   on the list).
2. Signed-in list shows the D1 booking (`BK-…`) with PAID badge, tour title,
   dates, total.
3. Click the row → `/account/bookings/<code>` detail renders full info +
   status note; tour link present.
4. Unknown/not-owned code → `/account/bookings/ZZ-NOPE` → localized not-found.
5. AccountShell nav: Profile ↔ Security ↔ My bookings all reachable;
   `aria-current` correct.
6. EN + VI pass; console clean.

Suites: `pnpm --filter @tourism/web test` (target ≥ 146 + new),
typecheck/lint/build both apps; `pnpm --filter @tourism/api test` green.

---

## 9. Files (planned)

**New (FE):**

- `apps/web/src/app/[locale]/(site)/account/bookings/page.tsx` + `loading.tsx`
- `apps/web/src/app/[locale]/(site)/account/bookings/[code]/page.tsx` +
  `loading.tsx`
- `apps/web/src/features/bookings-list/BookingsList.tsx`
- `apps/web/src/features/bookings-list/BookingRow.tsx`
- `apps/web/src/features/bookings-list/BookingStatusBadge.tsx`
- `apps/web/src/features/bookings-list/BookingDetail.tsx`
- `apps/web/src/features/bookings-list/status.ts` (`mapBookingStatus`) (+ test)
- `apps/web/src/features/bookings-list/format.ts`
  (`bookingDateRange`, `pickTourTitle`, `isTruncatedList`) (+ test)

**Modified (FE):**

- `apps/web/src/lib/api/bookings.ts` (+ `getMyBookings`, + test)
- `apps/web/src/features/account/AccountShell.tsx` (third nav item)
- `apps/web/src/features/booking/checkout-status.tsx` (PAID/home link →
  `/account/bookings`)
- `apps/web/src/app/[locale]/(site)/checkout/success/page.tsx` /
  `cancel/page.tsx` (home CTA → `/account/bookings` where apt)
- `apps/web/messages/en.json`, `vi.json` (`Bookings` namespace + `Account.nav.bookings`)
- `apps/web/src/lib/api/schema.d.ts` (regenerated)

**Modified (BE, pure-doc):**

- `apps/api/src/modules/bookings/dto/booking.dto.ts` (nested summary DTOs)

**Docs:**

- `docs/planning/roadmap.md` (mark D2 done at the end)
- `docs/reference/api-overview.md` (note BookingDto now documents the join)

**Unchanged (reused seams):** `lib/supabase/server` (`getUser`/session),
`features/auth/actions` (`syncUser`), `getBookingByCode`, `AccountShell`
scaffold, booking controller/service (runtime untouched).

---

## 10. Risks / notes

- **DTO change ripples to `GET /bookings/:code` typing too** — intended:
  `getBookingByCode` callers (D1 success poll) gain `.tour`/`.departure`
  typing but D1 only reads the `Pick` projection, so no D1 behaviour changes.
- **`departure.status` optionality** — declaring it `required:false` keeps the
  list endpoint honest (it omits status). The detail page must treat
  `status` as possibly-undefined.
- **Empty/again states** — a brand-new account with zero bookings must render
  the empty state, not crash; e2e covers a populated account, unit covers the
  empty branch.
- **No customer cancel** — by design; the detail page is read-only. Any
  "cancel" wording is avoided to prevent implying a capability that doesn't
  exist.
- **Dev servers:** kill stale 3000/3001 on EADDRINUSE; clear `apps/web/.next`
  after branch switches; reseed (`pnpm postman:seed`) so a PAID booking exists
  for e2e.
