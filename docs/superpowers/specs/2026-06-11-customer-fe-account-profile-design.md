# Customer FE — Account Profile (C2) — Design Spec

**Date:** 2026-06-11
**Branch:** `feat/customer-fe-account-profile`
**App:** `apps/web` (customer, Next.js 16 App Router, port 3001)
**Status:** Approved (design), pending implementation plan

> The first **signed-in** customer surface. C1 Core Auth shipped sign-in/up/forgot/reset/sign-out
> and a `UserMenu` whose **Account** link points at `/account` — which 404s today. C2 makes that
> route real: a page where a logged-in user **views and edits their profile** (`fullName`, `phone`,
> `locale`) against `GET/PATCH /api/v1/users/me`. Backend is **unchanged** ([[auth-stays-on-supabase]]).
> Follows the **layout-first** rule ([[fe-layout-first-redesign-later]]): faithful overall layout +
> correct behavior + a11y + i18n, **theme tokens only (no hex)**, reuse `@tourism/ui` first; bespoke
> visual polish is deferred to the later whole-product redesign pass.

---

## 1. Goal & Scope

A localized `/account` page for authenticated customers to read and update their profile. Wires up the
C1 `UserMenu` → Account seam. Reuses C1 auth/session/API seams; adds no backend changes.

**Brainstorm decisions (locked):**
- **Scope:** **Profile + a thin account shell.** Only the Profile section is built now. A lightweight
  `AccountShell` (account title + a minimal, extensible nav slot — a single "Profile" item today)
  wraps it, so Phase D (Booking history) and wishlist can be added as sibling routes/sections without
  re-architecting the layout. **No full sidebar build-out** — booking history will be its own route
  (`/account/bookings`) in Phase D, not a tab nested in this page.
- **Layout:** Profile content is a **single-column card form** inside `(site)` chrome.
- **`locale` field:** PATCHes the DB profile preference only — **no URL redirect, no i18n coupling.**
  The `/en`–`/vi` display routing stays next-intl's concern, unchanged. A helper text under the field
  clarifies it is the account preference, not the current page language.
- **USER_NOT_SYNCED handling:** **auto-sync then load** — transparent to the user (see §3).
- **Phone clear limitation (accepted):** backend `phone` validates 6–20 chars *when present*, so an
  empty phone cannot be cleared to `null` without a backend change (out of scope). C2 **omits empty/
  unchanged optional fields** from the PATCH body (correct partial-update semantics) and documents
  "cannot clear `phone`/`fullName` to empty in C2" as a known limitation + follow-up.
- **Colors:** **default theme tokens only** (`bg-card`, `text-foreground`, `text-muted-foreground`,
  `border-border`, `ring-ring`, …). **No hardcoded hex.**

**In scope:**
- New API helper `lib/api/users.ts`: `getMe(token)` + `updateMe(token, body)` using the existing typed
  `createApiClient(token)` (envelope middleware throws `ApiError` on error; `USER_NOT_SYNCED` is
  detectable via `ApiError.code`).
- New route `app/[locale]/(site)/account/page.tsx` (RSC) with a **reverse guard** (signed-out →
  `sign-in?returnTo=/account`), auto-sync, and profile fetch.
- New feature dir `features/account/`: `AccountShell`, `ProfileForm` (client, RHF+zod), `IdentityBlock`
  (read-only), `actions.ts` (server action `updateProfile`), `schema.ts` (zod) + a body-builder helper.
- `account/loading.tsx` (shimmer skeleton).
- New `Account` i18n namespace in `messages/{en,vi}.json`.
- Tests (logic = TDD; UI = browser-verified). See §6.

**Out of scope (unchanged / deferred):**
- Any backend change (DTOs, validators, routes).
- Booking history (Phase D), wishlist (B4.4 backend exists; FE later), Google OAuth (C3), 2FA (C4).
- Email change / password change (Supabase-managed; not part of `users/me`).
- Final visual tuning (palette, imagery, motion) — the later whole-product redesign pass.
- Admin app.

---

## 2. Architecture & data flow

### Route & guard
- `app/[locale]/(site)/account/page.tsx` — **RSC**, inside `(site)` chrome (`SiteHeader`/`SiteFooter`),
  localized via the `[locale]` segment.
- **Reverse guard** (mirror of the `(auth)` group, opposite direction): the page reads the session via
  `@/lib/supabase/server`. **No session → `redirect('/{locale}/sign-in?returnTo=/account')`** using the
  C1 `returnTo` seam (already sanitized + hard-nav on the sign-in side). The guard lives in the **page**
  (not a separate `(account)` layout) so it can also drive the sync + fetch in one place.

### Server load sequence (in the RSC)
1. Read session. No session → redirect (above).
2. `await syncUser()` — idempotent mirror of the Supabase user into the local DB (existing action).
3. `await getMe(token)` → `UserDto`.
4. If `getMe` throws `ApiError` with `code === 'USER_NOT_SYNCED'`: call `syncUser()` once more and
   retry `getMe` a single time (covers a first-ever visit race where the mirror just landed).
5. Any other error (or retry still failing) → render an error state (alert + retry link), not a crash.
6. Pass the resolved `UserDto` to the client `ProfileForm`.

### Mutation (server action)
- `features/account/actions.ts` → `updateProfile(input)`:
  - `"use server"`; read session token via `createSupabaseServerClient`.
  - Build the PATCH body with the **body-builder** (only changed + non-empty fields; §3).
  - If the body is empty (nothing changed) → return `{ ok: true, noop: true }` (skip the network call).
  - `updateMe(token, body)`; on success `revalidatePath('/{locale}/account')`.
  - Returns a typed result: `{ ok: true } | { ok: true, noop: true } | { ok: false, error }`.
    `error` distinguishes `NO_SESSION` / `VALIDATION` / `REQUEST_FAILED` for messaging.
- The client `ProfileForm` calls the action, then surfaces success/error via `alert-custom` and resets
  its dirty state on success.

### API helper (`lib/api/users.ts`)
```ts
export type User = components["schemas"]["UserDto"];
export type UpdateMeBody = components["schemas"]["UpdateMeDto"];

export async function getMe(token: string): Promise<User> { /* createApiClient(token).GET(...) */ }
export async function updateMe(token: string, body: UpdateMeBody): Promise<User> { /* PATCH */ }
```
- Uses the **typed `createApiClient(token)`** (envelope-unwrapping middleware), **not** the raw-fetch
  pattern of public `destinations.ts`. The middleware already throws `ApiError(code, message, status)`
  on an error envelope, so `USER_NOT_SYNCED` flows through as `ApiError.code`.

---

## 3. Validation, body-builder & the phone-clear constraint

### Client zod schema (`features/account/schema.ts`)
Mirrors `UpdateMeDto`, all optional:
- `fullName`: string, trimmed, **≤ 120** chars.
- `phone`: string, trimmed, **6–20** chars when non-empty (empty allowed in the *form*, handled by the
  body-builder — see below).
- `locale`: enum `'en' | 'vi'`.

### Body-builder (`buildUpdateBody(original, formValues)`)
Pure, unit-tested. Returns a `UpdateMeBody` containing **only fields that (a) changed vs the original
`UserDto` AND (b) are non-empty after trim.** Empty optional inputs are **omitted** (not sent as `""`).
Rationale: backend `phone` min-length 6 rejects `""`, and PATCH partial-update semantics mean "absent =
unchanged". An empty body → the action treats it as a no-op.

### Known limitation (documented, with follow-up)
A user **cannot clear** `phone` or `fullName` back to empty/`null` in C2, because the backend validator
forbids an empty `phone` and we omit empty fields. This is a rare real-world need (users *change*, not
*erase*, a phone). A future small **backend** change (allow explicit `null` in `UpdateMeDto` distinct
from "absent") would enable it — tracked as a follow-up, not done here.

---

## 4. Components (reuse-first)

All under `apps/web/src/features/account/` unless noted. Reuse `@tourism/ui` legacy/custom first
([[reuse-existing-ui-components]], [[shadcn-studio-blocks]]); compose, don't hand-roll.

- **`AccountShell.tsx`** — layout wrapper: account page title ("My account") + a **thin nav slot**
  rendering a single active "Profile" item (structured as a list so Phase D appends items). Single
  content column. Token colors only. Deliberately minimal — *not* a responsive sidebar.
- **`ProfileForm.tsx`** — `"use client"`, RHF + zod via `@hookform/resolvers` (already a dep). Fields:
  - `fullName` → `form-field` / `field-custom`.
  - `phone` → `phone-input` custom.
  - `locale` → a select (legacy `select`) with EN/VI options + helper text (preference, not page lang).
  - Submit → `button-custom` (loading/disabled while pending, disabled when not dirty).
  - Result feedback → `alert-custom` (success / error). Resets dirty state on success.
- **`IdentityBlock.tsx`** — read-only identity: `avatar-custom` (initials/email) + `email`, `role`,
  and "member since" from `createdAt` (formatted via the app's existing date formatting / `next-intl`).
- **`account/loading.tsx`** — route-level loading using `shimmer-skeleton` matching the card shape.

---

## 5. i18n

New `Account` namespace in `apps/web/messages/{en,vi}.json`. Keys (illustrative):
`title`, `nav.profile`, `identity.email`, `identity.role`, `identity.memberSince`,
`fields.fullName`, `fields.phone`, `fields.locale`, `fields.localeHelp`,
`actions.save`, `status.saved`, `status.noChanges`, `status.error`, `status.notSynced`,
`role.CUSTOMER`, `role.ADMIN`. All user-visible strings localized EN + VI. No hardcoded copy in JSX.

---

## 6. Testing

**TDD (logic — write tests first):**
- `lib/api/users.test.ts` — `getMe`/`updateMe` happy path + `USER_NOT_SYNCED` surfaced as `ApiError`
  (mock the fetch/envelope layer as existing api tests do).
- `features/account/schema.test.ts` — zod accept/reject (length bounds, locale enum).
- `features/account/build-update-body.test.ts` — only changed + non-empty fields included; unchanged
  omitted; empty omitted; identical values → empty body (no-op).
- `features/account/actions.test.ts` — result mapping: success, no-op (empty body), `NO_SESSION`,
  `REQUEST_FAILED`; `revalidatePath` called on success.

**Browser verification (UI):** signed in as `customer@example.com` (creds from `pnpm postman:seed`,
`.tmp/postman.env.json`):
- `/en/account` + `/vi/account` load the profile (identity + populated form).
- Edit `fullName` / `phone` / `locale` → save → success alert → **persists after reload**.
- "No changes" save → no-op message, no error.
- Signed-out → `/account` redirects to `sign-in?returnTo=/account`; after sign-in, lands back on
  `/account`.
- Console clean; no layout shift; a11y (labels, focus, keyboard) sane.

Coverage target per repo standard (80%+) applies to the new logic modules; UI relies on browser
verification per [[fe-execution-workflow]].

---

## 7. Files (planned)

**New:**
- `apps/web/src/lib/api/users.ts` (+ `users.test.ts`)
- `apps/web/src/app/[locale]/(site)/account/page.tsx`
- `apps/web/src/app/[locale]/(site)/account/loading.tsx`
- `apps/web/src/features/account/AccountShell.tsx`
- `apps/web/src/features/account/ProfileForm.tsx`
- `apps/web/src/features/account/IdentityBlock.tsx`
- `apps/web/src/features/account/actions.ts` (+ `actions.test.ts`)
- `apps/web/src/features/account/schema.ts` (+ `schema.test.ts`)
- `apps/web/src/features/account/build-update-body.ts` (+ `build-update-body.test.ts`)

**Modified:**
- `apps/web/messages/en.json`, `apps/web/messages/vi.json` (`Account` namespace)
- `docs/planning/roadmap.md` (mark C2 done at the end)

**Unchanged (reused seams):** `lib/supabase/server`, `lib/api/client` (`createApiClient`),
`features/auth/actions` (`syncUser`), C1 `returnTo`/sign-in, `@tourism/ui` customs.

---

## 8. Risks / notes

- **Pooler read pattern:** `getMe` is a single-row read (no list+count), so the
  [[prisma-pooler-no-read-transaction]] `$transaction` pitfall does not apply here.
- **Auto-sync cost:** `syncUser()` runs on each `/account` load (idempotent upsert). Acceptable for a
  low-traffic account page; can be optimized later if needed.
- **Orphan `next dev` on 3001 / `.next` staleness:** per the run notes, kill the PID holding 3001 on
  `EADDRINUSE` and clear `apps/web/.next` after branch/dep changes before browser verification.
