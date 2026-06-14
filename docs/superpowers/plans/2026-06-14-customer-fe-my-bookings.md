# Customer FE — My Bookings (D2) — Implementation Plan

**Spec:** [specs/2026-06-14-customer-fe-my-bookings-design.md](../specs/2026-06-14-customer-fe-my-bookings-design.md)
**Branch:** `feat/customer-fe-my-bookings`
**Execution:** subagent-driven ([[fe-execution-workflow]]) — implementer +
combined spec/quality review per task; TDD on pure logic; theme tokens only;
reuse `@tourism/ui`; EN/VI parity.

Order is dependency-driven: backend DTO + schema regen first (unblocks typed
join), then API helper, then pure helpers, then i18n, then presentational
components, then routes, then D1 seam close, then the whole-branch gate.

---

## B1 — Backend nested DTOs + FE schema regen (pure-doc)

**Files:** `apps/api/src/modules/bookings/dto/booking.dto.ts`,
`apps/web/src/lib/api/schema.d.ts` (generated).

1. Add `BookingTourSummaryDto { slug, titleEn, titleVi }` and
   `BookingDepartureSummaryDto { startDate, endDate, status? }`
   (`status` → `@ApiProperty({ required: false, enum: DEPARTURE_STATUSES })`,
   mirror the `BOOKING_STATUSES` const-array style already in the file).
2. Add `tour!: BookingTourSummaryDto` and `departure!: BookingDepartureSummaryDto`
   `@ApiProperty({ type: ... })` to `BookingDto`.
3. **No** controller/service edits. Confirm `findOwnList` (tour+departure
   start/end) and `findByCodeForCaller` (tour+departure start/end/status)
   already return this shape.
4. Regenerate FE types: ensure api running (`pnpm --filter @tourism/api
   start:dev`), then `pnpm --filter @tourism/web api:types`. Confirm
   `schema.d.ts` `BookingDto` now has `tour` + `departure` (with `status?`).
5. **Gate:** `pnpm --filter @tourism/api test` green (87/87 — inert
   decorators); `pnpm --filter @tourism/api build` clean.

**Review:** spec-fidelity (pure-doc, no runtime change) + that the generated
types match. **Acceptance:** api tests green, FE `BookingDto.tour.titleVi`
resolves in a scratch `tsc`.

---

## T1 — `lib/api/bookings.ts` `getMyBookings` (TDD)

Add `getMyBookings(token): Promise<MyBooking[]>` (`MyBooking =
components["schemas"]["BookingDto"]`) mirroring `getBookingByCode`: GET
`/api/v1/bookings/me`, throw `ApiError("EMPTY",…,200)` on missing data.
Test mirrors `bookings.test.ts`: mocks the client, asserts path + unwrap +
empty-throw. **Acceptance:** new tests pass, typecheck clean.

---

## T2 — `features/bookings-list/status.ts` `mapBookingStatus` (TDD)

Pure: `(status: BookingStatus) => { labelKey: string; tone: "positive" |
"neutral" | "muted" | "info" }`. Exhaustive switch: PAID→{status.paid,
positive}, PENDING→{status.pending, neutral}, CANCELLED→{status.cancelled,
muted}, REFUNDED→{status.refunded, info}. Test all four + a TS `never`
exhaustiveness guard. **Acceptance:** 4 cases asserted, typecheck clean.

---

## T3 — `features/bookings-list/format.ts` helpers (TDD)

Pure: `bookingDateRange(startISO, endISO, locale)` (Intl, EN/VI tags,
same-day collapses to one date), `pickTourTitle({titleEn,titleVi}, locale)`,
`isTruncatedList(rows)` (`rows.length === 50`). Reuse the existing date
approach from `features/booking`/`tour-detail` if one is already shared; else
keep local + tested. Tests: EN vs VI, same-day vs multi-day, locale branch,
49/50/51. **Acceptance:** all branch tests pass.

---

## T4 — i18n `Bookings` namespace + `Account.nav.bookings` (EN/VI)

Add `Bookings.list.*`, `Bookings.detail.*`, `Bookings.status.*` (labels +
`note.*`) and `Account.nav.bookings` to `messages/en.json` + `vi.json`.
Insert preserving CRLF + key order (node script like D1). **Acceptance:**
node parity check → identical key sets EN/VI; `next-intl` loads.

---

## T5 — Badge + Row + List presentational components

`BookingStatusBadge.tsx` (tone→token classes, label via `Bookings.status`),
`BookingRow.tsx` (server; `Link`→`/account/bookings/<code>`; badge + title +
date range + seats + total + code), `BookingsList.tsx` (maps rows; renders
truncated note when `isTruncatedList`). Theme tokens only; reuse `@tourism/ui`
primitives where they fit. RTL tests: badge tone+label, row link href + shown
fields (mock `@/i18n/navigation` Link as `<a>`). **Acceptance:** tests pass,
no hex, a11y (semantic list, badge has text not color-only).

---

## T6 — `BookingDetail.tsx`

Server component: back link → `/account/bookings`; header (title + badge +
code); `<dl>` (departure range, seats, total, contact name/email/phone,
specialRequests when present, paidAt/cancelledAt when present); status note
line via `Bookings.status.note.*`; tour link → `/tours/<slug>`. D3 seam: no
review affordance. RTL test: contact shown, specialRequests hidden when null,
status note present. **Acceptance:** tests pass, handles `departure.status`
undefined.

---

## T7 — `AccountShell` third nav item

Extend `AccountSection` union with `"bookings"`; add
`{ section:"bookings", href:"/account/bookings", labelKey:"nav.bookings" }` to
`NAV_ITEMS`. Update the `href`/`labelKey` literal types. **Acceptance:** the
two existing account pages still typecheck; nav renders 3 tabs;
`aria-current` logic unchanged.

---

## T8 — `/account/bookings` list page + loading

RSC: reverse guard (`returnTo:/account/bookings`) → `syncUser()` → token →
`getMyBookings` in `try` (USER_NOT_SYNCED retry once, copy `/account`
`loadProfile`). Render `AccountShell active="bookings"` → empty state OR
`BookingsList`. `loading.tsx` = ShimmerSkeleton rows. **Acceptance:** guard
redirect verified in e2e; empty + populated branches both compile/typecheck.

---

## T9 — `/account/bookings/[code]` detail page + loading

RSC: `await params` (locale, code); reverse guard
(`returnTo:/account/bookings/<code>`) → `syncUser()` →
`getBookingByCode(token, code)` in `try`; 404/`BOOKING_NOT_FOUND` →
`notFound()`. Render `AccountShell active="bookings"` → `BookingDetail`.
`loading.tsx` skeleton. **Acceptance:** not-found path renders localized
not-found; owned booking renders detail.

---

## T10 — D1 seam close

`checkout-status.tsx` PAID panel home link + `checkout/success` /
`checkout/cancel` "back home" CTA → `/account/bookings` (where the user
expects to find the booking). Keep `/tours` for the cancel "browse" CTA.
Update the D1 success/cancel tests' link-href assertions accordingly.
**Acceptance:** D1 tests updated + green; no dangling `/` home link where
`/account/bookings` is intended.

---

## T11 — Whole-branch gate + e2e + docs + merge gate

1. Full suite `pnpm --filter @tourism/web test` (≥146 + new), `tsc --noEmit`
   both apps, `lint`, `build`; `pnpm --filter @tourism/api test`.
2. Final whole-branch review (opus) — spec fidelity + security (no token to
   client; owner-scoping inherited) + a11y.
3. Browser e2e (servers up; `pnpm postman:seed` for a PAID booking): the 6
   spec scenarios (guard round-trip, list shows D1 booking, row→detail,
   unknown code→not-found, nav reachability, EN+VI, console clean).
4. Update `docs/planning/roadmap.md` (D2 done) + `docs/reference/api-overview.md`
   (BookingDto documents join).
5. **STOP — confirm with Yuri before** rebase-and-merge + push + delete branch
   ([[feature-branch-workflow]]).

---

## Sequencing

B1 → T1 → (T2, T3 parallel) → T4 → (T5, T6 parallel after T2/T3/T4) → T7 →
(T8, T9 parallel after T5/T6/T7) → T10 → T11.

## Reused seams (do not rebuild)

`getUser`/session (`lib/supabase/server`), `syncUser` (`features/auth/actions`),
`getBookingByCode` (`lib/api/bookings.ts`), `AccountShell`, `ShimmerSkeleton`,
`sanitizeReturnTo`, the `/account` `loadProfile` guard pattern.
