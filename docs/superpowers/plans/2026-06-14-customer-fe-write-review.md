# Customer FE — Write Review (D3) — Implementation Plan

**Spec:** [specs/2026-06-14-customer-fe-write-review-design.md](../specs/2026-06-14-customer-fe-write-review-design.md)
**Branch:** `feat/customer-fe-write-review`
**Execution:** subagent-driven ([[fe-execution-workflow]]) — TDD on pure logic;
theme tokens only; reuse `@tourism/ui`; EN/VI parity. **Backend untouched.**

Dependency order: API helper → pure helpers (schema, error-map) → server action
→ i18n → form → page → booking-detail seam → whole-branch gate.

---

## R1 — `lib/api/reviews.ts` `createReview` (TDD)

`createReview(token, body): Promise<CreatedReview>` (`CreateReviewBody =
CreateReviewDto`, `CreatedReview = ReviewDto`) mirroring `createBookingRequest`:
POST `/api/v1/reviews`, throw `ApiError("EMPTY",…,200)` on missing data. Test
mirrors `bookings.test.ts`: path + body + token + EMPTY-throw + ApiError
propagation. **Acceptance:** new tests pass, typecheck clean.

---

## R2 — `features/review/schema.ts` `reviewSchema` (TDD)

zod mirroring `CreateReviewDto` MINUS `bookingCode` (the page supplies it):
`rating` int 1–5 (`errors.ratingRequired`), `title` optional string ≤120
(`errors.titleMax`), `body` string 10–2000 (`errors.bodyMin`/`errors.bodyMax`).
`ReviewValues = z.infer`. Tests: rating bounds (0/1/5/6, non-int), body 9/10/2000/2001,
title 120/121, optional title empty ok. **Acceptance:** branch tests pass.

---

## R3 — `features/review/review-error.ts` `mapReviewError` (TDD)

`(code) → i18n key`: `REVIEW_NOT_ELIGIBLE→errors.notEligible`,
`REVIEW_ALREADY_EXISTS→errors.alreadyReviewed`,
`BOOKING_NOT_FOUND`/`BOOKING_FORBIDDEN→errors.generic`, default→errors.generic.
Test each. **Acceptance:** all cases asserted.

---

## R4 — `features/review/actions.ts` `createReview` server action (TDD)

`"use server"`; `createReview(bookingCode, values)`: getSession → no session
`{ok:false, code:"NO_SESSION"}`; `reviewSchema.safeParse` fail → `VALIDATION`;
build `CreateReviewBody` (omit empty `title`); call `createReview` API; on
`ApiError` → `{ok:false, code:err.code}`; else console.error + `REQUEST_FAILED`;
success → `{ok:true}`. Token never reaches client. Test mirrors D1
`actions.test.ts` (mock client + session). **Acceptance:** mapping + no-session
+ validation paths tested.

---

## R5 — i18n `Review` namespace (EN/VI)

Add `Review.form.*`, `Review.errors.*`, `Review.success.*`, `Review.ineligible.*`
to `messages/en.json` + `vi.json` (node insert preserving CRLF). **Acceptance:**
parity check identical key sets; `next-intl` loads.

---

## R6 — `features/review/ReviewForm.tsx` (client)

RHF + zodResolver. Props `{ bookingCode, tourTitle }`. `Rating` input via
Controller (`value`/`onValueChange`, `name="rating"`, aria-label); `title`
`Field`+`Input`; `body` `Field`+textarea with min-length help; live disable on
submit. Submit → `createReview` action; `!ok` → `Alert` destructive with
`t(mapReviewError(code))`; `ok` → success panel (`success.title/body` mentions
pending approval + back-to-booking link). RTL test (mock action): renders,
client-validates, success swap, error alert. **Acceptance:** tests pass, theme
tokens only, a11y (rating keyboard + labelled fields).

---

## R7 — `/account/bookings/[code]/review` page + loading

RSC: `await params` (locale, code); reverse guard
(`returnTo:/account/bookings/<code>/review`); `syncUser()`;
`getBookingByCode` in `try` → 404/403 → `notFound()`; if `status !== "PAID"`
→ ineligible panel (`Review.ineligible.*` + back link); else `AccountShell
active="bookings"` → header + `ReviewForm`. `loading.tsx` skeleton.
**Acceptance:** guard redirect + ineligible gate + form render all compile;
e2e covers them.

---

## R8 — `BookingDetail` "Write a review" seam

Add a primary `Link` → `/account/bookings/<code>/review` shown only when
`booking.status === "PAID"` (new `text.writeReview` string prop + a `canReview`
derive, or pass `status` already present). Extend `BookingDetail.test.tsx`:
link present for PAID, absent otherwise. Wire the label through the detail
page's i18n. **Acceptance:** detail tests green; link gated on PAID.

---

## R9 — Whole-branch gate + e2e + docs + merge gate

1. `pnpm --filter @tourism/web test` (≥173 + new), `tsc --noEmit`, `lint`,
   `build`; api suite unchanged (sanity run).
2. Final whole-branch review (opus): spec fidelity + security (no token to
   client; ownership inherited) + a11y (rating control).
3. Browser e2e (servers up; `pnpm postman:seed`; pick a PAID booking with no
   existing review — e.g. D1 `BK-…`): the 7 spec scenarios (seam → form,
   invalid blocked, valid → pending panel, duplicate → 409 message, non-PAID
   ineligible gate, signed-out returnTo, EN+VI, console clean). Verify the
   created review is `isApproved=false` via API/db.
4. Update `docs/planning/roadmap.md` (D3 done → **Phase D complete**) +
   `docs/reference/api-overview.md` if useful.
5. **STOP — confirm with Yuri before** rebase-and-merge + push + delete branch
   ([[feature-branch-workflow]]).

---

## Sequencing

R1 → (R2, R3 parallel) → R4 → R5 → R6 → R7 → R8 → R9.

## Reused seams (do not rebuild)

`getUser`/session, `syncUser`, `getBookingByCode`, `AccountShell`,
`Rating`/`Field`/`Input`/`Button`/`Alert`/`ShimmerSkeleton`, `sanitizeReturnTo`,
the D1 `createBooking` action shape, the booking-detail page's guard pattern.
