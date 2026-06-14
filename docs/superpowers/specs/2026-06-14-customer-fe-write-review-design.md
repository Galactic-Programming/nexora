# Customer FE — Write Review (D3) — Design Spec

**Date:** 2026-06-14
**Branch:** `feat/customer-fe-write-review`
**App:** `apps/web` (customer, Next.js 16 App Router, port 3001)
**Status:** Approved (design), pending implementation plan

> Final sub-phase of Phase D (D1 booking ✅ → D2 my-bookings ✅ → **D3 write
> review**). Closes the D2 seam: a customer who completed (PAID) a booking can
> submit a star rating + written review for that trip. Reviews are created
> **pending moderation** (`isApproved=false`) and only appear publicly on the
> tour page after an admin approves them (existing B4.3 flow). **Backend is
> unchanged** — `POST /reviews` already enforces ownership, PAID-eligibility,
> and one-review-per-booking. Layout-first ([[fe-layout-first-redesign-later]]):
> theme tokens only, reuse `@tourism/ui`, polish deferred.

---

## 1. Goal & Scope

From a PAID booking's detail page, the customer clicks **Write a review**,
lands on a dedicated form page, submits rating + body (+ optional title), and
sees a "submitted — pending approval" confirmation.

**Brainstorm decisions (locked):**

- **Dedicated page** `/account/bookings/[code]/review` (not an inline form) —
  consistent with D1's dedicated booking-form page; clean RSC guard +
  server-side eligibility; shareable URL.
- **Booking-centric only.** The single entry point is a "Write a review" link
  on the booking detail page, shown only for PAID bookings. The tour detail
  page is unchanged (still displays approved reviews only); no "review this
  tour" affordance there (would need a viewer↔booking lookup — out of scope,
  and the backend model attaches a review to a *booking*, not a bare tour).
- **No new "already-reviewed" signal.** The backend exposes no GET to check
  whether a booking already has a review, and we will **not** add a backend
  runtime change (D2 kept BE pure-doc; D3 keeps BE untouched). So the link
  shows for every PAID booking and a duplicate submit is handled gracefully
  via the `REVIEW_ALREADY_EXISTS` (409) → friendly "already reviewed" message.
- **Pending-moderation is explicit in the copy** — the success panel states
  the review awaits approval before appearing publicly, so the customer isn't
  confused when it doesn't immediately show on the tour page.

**In scope:**

- New route `app/[locale]/(site)/account/bookings/[code]/review/page.tsx`
  (+ `loading.tsx`): reverse guard → load booking → eligibility gate → form.
- `features/review/`: `ReviewForm` (client, RHF+zod, `Rating` input), pure
  helpers `reviewSchema` + `mapReviewError`, server action `createReview`.
- `lib/api/reviews.ts`: typed `createReview(token, body)` helper.
- `BookingDetail` seam: "Write a review" link on PAID bookings →
  `/account/bookings/<code>/review`.
- i18n namespace `Review` (EN/VI).
- Tests: TDD on schema/error-map/action; RTL for form; browser e2e.

**Out of scope (deferred / not planned):**

- Editing or deleting a submitted review (no backend endpoint; one-shot).
- Showing the customer's own pending review anywhere (no GET; success panel
  only).
- Listing/admin moderation UI (admin FE, separate).
- Backend changes of any kind (incl. a hasReview flag or a my-reviews list).
- Tour-page "write review" entry; per-pixel polish.

---

## 2. Backend contract (unchanged — reference)

`POST /reviews` body `CreateReviewDto`:

- `bookingCode` — `^BK-[A-Z0-9]{6,12}$` (the FE already has it from the route).
- `rating` — int 1–5 (required).
- `title` — optional, ≤120.
- `body` — required, 10–2000 chars.

Returns `ReviewDto` (`isApproved=false` on create). Errors:

| Status | code | FE handling |
| --- | --- | --- |
| 401 | `USER_NOT_SYNCED` | guard/sync retry (shouldn't surface) |
| 404 | `BOOKING_NOT_FOUND` | `notFound()` on page load; on submit → generic |
| 403 | `BOOKING_FORBIDDEN` | `notFound()` (not caller's booking) |
| 400 | `REVIEW_NOT_ELIGIBLE` | "only completed (paid) trips can be reviewed" |
| 409 | `REVIEW_ALREADY_EXISTS` | "you've already reviewed this booking" |

---

## 3. Review page — `/account/bookings/[code]/review`

### 3.1 RSC (`page.tsx`)

1. `await params` (`locale`, `code`), `setRequestLocale`.
2. **Reverse guard** (same as booking detail): `getUser()`; signed-out →
   `redirect({ href: { pathname: "/sign-in", query: { returnTo:
   "/account/bookings/<code>/review" } }, locale })`.
3. `syncUser()`; `getBookingByCode(token, code)` in `try`; 404/403 →
   `notFound()` (can't review a booking you can't see).
4. **Eligibility gate:** if `booking.status !== "PAID"` → render an ineligible
   panel (not the form): explain only completed/paid trips can be reviewed,
   with a back link to the booking. (Belt-and-suspenders with the backend's
   `REVIEW_NOT_ELIGIBLE`; keeps a non-PAID deep-link graceful.)
5. Otherwise render `AccountShell active="bookings"` → a header (tour title +
   "Review your trip") + `ReviewForm` seeded with `bookingCode` + tour title.

### 3.2 `ReviewForm` (client)

RHF + zod (`reviewSchema`):

- `rating` — int 1–5, required; rendered with the `@tourism/ui` **`Rating`**
  input (`value`/`onValueChange` via a Controller; keyboard-accessible;
  `aria-label` "Rating"). zod message key `errors.ratingRequired`.
- `title` — optional ≤120 (`Field` + `Input`).
- `body` — required 10–2000 (`Field` + textarea); helper shows min length.
- Submit → `createReview` server action with `{ bookingCode, rating, title?,
  body }`. `title`/empty omitted (backend `@IsOptional`). On `{ ok: true }` →
  swap the form for a success panel ("review submitted — pending approval");
  on `{ ok: false, code }` → inline `Alert` via `mapReviewError(code)`,
  button re-enabled.

### 3.3 Server action `createReview` (features/review/actions.ts)

Pattern copied from D1 `createBooking`: `"use server"`, session token read
server-side, re-validate with `reviewSchema.safeParse`, call `POST /reviews`
via the typed client, map `ApiError.code` → `{ ok: true } | { ok: false, code:
ReviewErrorCode }`. No token reaches the client.

---

## 4. `BookingDetail` seam (R8)

On PAID bookings only, add a primary "Write a review" `Link` →
`/account/bookings/<code>/review` (alongside the existing "View tour" link).
Non-PAID bookings show nothing new. The detail page passes `booking.status` —
already available. Existing `BookingDetail.test.tsx` extended: link present for
PAID, absent for CANCELLED/PENDING/REFUNDED.

---

## 5. `lib/api/reviews.ts`

```ts
export type CreateReviewBody = components["schemas"]["CreateReviewDto"];
export type CreatedReview = components["schemas"]["ReviewDto"];
export async function createReview(token, body): Promise<CreatedReview> {
  const { data } = await createApiClient(token).POST("/api/v1/reviews", { body });
  if (!data) throw new ApiError("EMPTY", "Empty /reviews response", 200);
  return data;
}
```

Mirrors `createBookingRequest`.

---

## 6. i18n — namespace `Review` (EN/VI)

- `form.*`: title, subtitle, ratingLabel, titleLabel, titlePlaceholder,
  bodyLabel, bodyPlaceholder, bodyHelp, submit, submitting, back.
- `errors.*`: ratingRequired, bodyMin, bodyMax, titleMax, notEligible,
  alreadyReviewed, generic.
- `success.*`: title, body (mentions pending approval), backToBooking.
- `ineligible.*`: title, body, backToBooking (non-PAID gate).

EN/VI key parity enforced (node check).

---

## 7. Testing

**TDD (pure logic):** `reviewSchema` bounds (rating 1–5 int, body 10–2000,
title ≤120, optional title); `mapReviewError` (each code → key, default
generic); `createReview` action result mapping (mock client like D1).

**Component (RTL):** `ReviewForm` renders rating + body; client validation
blocks empty/short body; submit success swaps to the success panel; server
error renders the mapped alert (mock the action). `BookingDetail` link
present-on-PAID / absent-otherwise.

**Browser e2e (Playwright):**

1. From a PAID booking detail → "Write a review" → review page (form shown).
2. Submit invalid (no rating / 3-char body) → client errors; no navigation.
3. Submit valid → success panel ("pending approval"); DB has a row with
   `isApproved=false` (verify via API/db).
4. Re-open the review page for the same booking + submit again → `409` →
   "already reviewed" message.
5. Deep-link the review page for a non-PAID booking → ineligible panel (no
   form).
6. Signed-out deep-link → sign-in returnTo round-trip.
7. EN + VI pass; console clean.

Suites: `pnpm --filter @tourism/web test` (≥173 + new), typecheck/lint/build;
api suite untouched.

---

## 8. Files (planned)

**New (FE):**

- `apps/web/src/app/[locale]/(site)/account/bookings/[code]/review/page.tsx` +
  `loading.tsx`
- `apps/web/src/features/review/ReviewForm.tsx`
- `apps/web/src/features/review/schema.ts` (+ test)
- `apps/web/src/features/review/review-error.ts` (`mapReviewError`) (+ test)
- `apps/web/src/features/review/actions.ts` (+ test)
- `apps/web/src/lib/api/reviews.ts` (+ test)

**Modified (FE):**

- `apps/web/src/features/bookings-list/BookingDetail.tsx` (+ its test)
- `apps/web/messages/en.json`, `vi.json` (`Review` namespace)
- `docs/planning/roadmap.md` (mark D3 — Phase D complete)
- `docs/reference/api-overview.md` (note the review-create FE path, if useful)

**Unchanged (reused seams):** `lib/supabase/server`, `getBookingByCode`,
`features/auth/actions` (`syncUser`), `sanitizeReturnTo`, `Rating`/`Field`/
`Input`/`Button`/`Alert` from `@tourism/ui`, `AccountShell`.

---

## 9. Risks / notes

- **No idempotent client guard for double-review** — by design; the 409 path
  is the guard. The form disables the submit button while pending to avoid
  accidental double-submit within one attempt.
- **Pending-moderation invisibility** — the success copy must set the
  expectation, else customers think the submit failed when the review doesn't
  appear on the tour page.
- **Eligibility drift** — a booking could be PAID at page-load then refunded
  before submit; the backend's `REVIEW_NOT_ELIGIBLE` still guards it and the
  FE maps it to a message. No client-side race handling needed.
- **`Rating` is a client component** — fine inside the client `ReviewForm`;
  the page stays a server component and passes only serializable props.
- **Dev servers:** kill stale 3000/3001 on EADDRINUSE; reseed
  (`pnpm postman:seed`) for a fresh PAID booking without an existing review
  (seed review targets already have reviews — use a different PAID booking,
  or the D1 `BK-…` which has none).
