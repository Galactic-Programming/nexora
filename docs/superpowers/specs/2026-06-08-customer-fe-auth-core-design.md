# Customer FE — C1 Core Auth — Design Spec

**Date:** 2026-06-08
**Branch:** `feat/customer-fe-auth-core`
**App:** `apps/web` (customer, Next.js 16 App Router, port 3001)
**Status:** Approved (design), pending implementation plan

> Phase C (Auth & Account) = **C1. Core Auth (this spec) → C2. Account profile → C3. Google OAuth → C4. 2FA TOTP**.
> Builds on A (Supabase browser/server client + session-refresh middleware, API client that accepts an access token, `ApiError`, layout, i18n EN/VI) and the live backend auth surface (`POST /auth/sync`, `GET/PATCH /users/me`).
> Auth provider stays **Supabase** (no self-managed rewrite — see decision memory). Backend is unchanged in C1; all work is frontend on top of `@supabase/supabase-js` + `@supabase/ssr`.
> Ships on its own branch, rebase-and-merged to `master` after review.
> Priority is **layout-first**: faithful overall layout + correct behavior + a11y + i18n; visual polish is a deliberate later pass (reuse `@tourism/ui`, do not build bespoke UI).

---

## 1. Goal & Scope

Make the email/password authentication loop work end-to-end against Supabase + the backend
user-mirroring endpoint, so a visitor can create an account, verify email, sign in, recover a
forgotten password, and sign out — with their Supabase user mirrored into the local DB via
`POST /auth/sync`. The `UserMenu` already links to `/sign-in` (currently a dead route); C1 makes
that route and the surrounding flow real.

**In scope (C1):**

- Auth pages (localized, under an `(auth)` route group with a shared centered-card layout):
  **sign-in, sign-up (+ email verification), forgot-password, reset-password**.
- A non-localized **`/auth/callback`** route handler: `exchangeCodeForSession` → `syncUser` →
  sanitized redirect. Shared by email-verify + password-recovery now, and Google (C3) later.
- **`syncUser` server action**: read the server-side Supabase session, call `POST /auth/sync` with
  the access token via the existing `createApiClient(token)` to create/refresh the local user row.
- **Sign-out** (`supabase.auth.signOut()` → `/`).
- **`returnTo` plumbing**: auth pages read `?returnTo=` (sanitized, same-origin relative only) and
  redirect there after success; default `/`. Prepares Phase D "Book now → login → return".
- **Middleware update**: keep session refresh; redirect already-signed-in users away from auth
  pages; let `/auth/callback` bypass the i18n rewrite.
- **`UserMenu` → dropdown** (`dropdown-menu-custom` + `avatar-custom`): signed-in shows email/avatar
  with **Sign out** and an **Account** link placeholder (the page lands in C2).
- `Auth` i18n namespace (EN/VI); `Nav` additions (account, signOut).
- Add dependency **`@hookform/resolvers`** to `apps/web` (for `zodResolver`).
- Unit tests (Vitest + RTL, Supabase mocked), ≥80% on new logic.

**Out of scope (deferred, seams left):**

- **C2** Account profile page (`/account`, `GET/PATCH /users/me`) — UserMenu links to it but the page is C2.
- **C3** Google OAuth — `signInWithOAuth({ provider:'google' })` plugs into the same `/auth/callback`
  and `returnTo` plumbing built here.
- **C4** 2FA TOTP enroll/challenge — sign-in leaves a seam to check AAL and branch to a challenge step.
- Per-pixel visual polish; admin auth (`apps/admin`).
- Supabase dashboard config (enable Confirm-email, Custom SMTP/Resend, redirect allow-list) is an
  operational one-time task documented in a runbook, not code — the flow works for both
  confirm-email ON and OFF (it branches on whether `signUp` returns a session).

---

## 2. Backend & Supabase contract (already available)

- **`POST /auth/sync`** (requires Supabase JWT) → upserts the local `User` (CUSTOMER) keyed by the
  Supabase `sub`; idempotent; returns `UserDto`. Call once after sign-in / sign-up / verify.
- **`GET /users/me`** → `401 USER_NOT_SYNCED` until `/auth/sync` has run (relevant for C2; in C1 it
  tells us sync must happen at sign-in).
- Supabase (`@supabase/supabase-js` v2 + `@supabase/ssr` v0.10, already wired):
  `auth.signUp`, `auth.signInWithPassword`, `auth.signOut`, `auth.resetPasswordForEmail`,
  `auth.updateUser`, `auth.exchangeCodeForSession`, `auth.getUser`/`getSession`.
- Existing wiring reused as-is: `lib/supabase/{client,server,middleware}.ts`,
  `lib/api/client.ts` `createApiClient(accessToken)` (already supports the bearer token).

---

## 3. Auth flows (EN/VI)

All forms are **client components** using `createSupabaseBrowserClient()` + react-hook-form + zod
(`zodResolver`). Friendly, localized error messages; `alert-custom` for inline error/success.

- **Sign-up** — `signUp({ email, password, options: { emailRedirectTo: <origin>/auth/callback?next=<returnTo> } })`.
  - If a **session is returned** (confirm-email OFF) → call `syncUser` → redirect `returnTo` ‖ `/`.
  - If **no session** (confirm-email ON) → render a **"Check your email"** state.
  - This branch-on-session makes the flow correct for both dashboard configurations.
- **Email verification** — link → `/auth/callback?code&next` → `exchangeCodeForSession` →
  `syncUser` → redirect `next` ‖ `/`.
- **Sign-in** — `signInWithPassword({ email, password })` → `syncUser` → redirect `returnTo` ‖ `/`.
  Errors mapped: invalid credentials, email-not-confirmed (offer resend), rate-limited.
  *Seam (C4):* after sign-in, check `mfa.getAuthenticatorAssuranceLevel`; if a second factor is
  required, branch to a challenge step (built in C4) — in C1 no factor exists so it's a straight pass.
- **Forgot password** — `resetPasswordForEmail(email, { redirectTo: <origin>/auth/callback?next=/reset-password })`
  → "Check your email" state.
- **Reset password** — recovery link → callback exchanges code (recovery session) → redirect
  `/reset-password` → form `updateUser({ password })` → redirect sign-in (or `/`).
- **Sign-out** — `signOut()` → `/` (from the UserMenu dropdown).

---

## 4. Architecture & directory layout (`apps/web/src/`)

```text
app/[locale]/(auth)/
  layout.tsx                       # shared centered-card auth shell (server)
  sign-in/page.tsx                 # renders <SignInForm/>
  sign-up/page.tsx                 # renders <SignUpForm/>
  forgot-password/page.tsx         # renders <ForgotPasswordForm/>
  reset-password/page.tsx          # renders <ResetPasswordForm/>
app/auth/callback/route.ts         # NON-localized route handler: code exchange -> sync -> redirect
features/auth/
  schemas.ts (+ .test)             # zod: signIn, signUp, forgot, reset (email + password rules)
  redirect.ts (+ .test)            # sanitizeReturnTo() — same-origin relative paths only
  actions.ts (+ .test)             # 'use server': syncUser(), signOut()
  sign-in-form.tsx                 # client: RHF + supabase signInWithPassword
  sign-up-form.tsx                 # client: signUp + check-email state
  forgot-password-form.tsx         # client: resetPasswordForEmail + check-email state
  reset-password-form.tsx          # client: updateUser({password})
  check-email-notice.tsx           # shared "we sent you a link" panel
  auth-error.ts (+ .test)          # map Supabase AuthError -> i18n message key
components/layout/
  user-menu.tsx (modify)           # dropdown: email/avatar -> Account (C2) + Sign out
lib/supabase/middleware.ts (modify)# + redirect signed-in away from auth pages; callback bypass
middleware.ts (modify, root)       # ensure /auth/callback skips i18n rewrite, matcher correct
messages/en.json, vi.json (modify) # Auth namespace + Nav additions
apps/web/package.json (modify)     # + @hookform/resolvers
```

Rationale: forms are small, single-purpose client components sharing zod schemas + one `syncUser`
action; the only server entry points are the callback route + the two server actions. Mirrors the
B-phase pattern (schemas/helpers/view split → focused components → route wiring).

---

## 5. Reuse (priority: existing components)

**Visual foundation — the `shadcn-studio/blocks` auth family** (a matched, cohesive set the project
already ships; covers every C1 page + 2FA for C4):

- `blocks/login-page-01/` → sign-in, `blocks/register-01/` → sign-up,
  `blocks/forgot-password-01/` → forgot, `blocks/reset-password-01/` → reset
  (`blocks/two-factor-authentication-01/` reserved for C4).
- These blocks are **presentational templates only** (`onSubmit preventDefault`, hardcoded English,
  legacy `Field`/`Input`/`InputGroup` with an eye-toggle, a Google button, `AuthBackgroundShape` +
  `Logo`, card layout). **Adapt, don't rebuild:** copy each block's markup into `apps/web` auth
  components, then (a) wire to react-hook-form + zod + Supabase, (b) replace all copy with the `Auth`
  i18n namespace, (c) strip demo-only bits (magic-link link, "Login as User/Admin" quick buttons,
  "Shadcn Studio" branding/`Logo` → the app brand), (d) show validation/auth errors via the legacy
  `Field` invalid state and/or `alert-custom`, (e) keep the **Google button** rendered but inert as a
  **C3 seam** (disabled/"coming soon" or wired in C3 — no OAuth logic in C1), (f) drop "Remember me"
  and the privacy-policy checkbox unless trivially kept.
- On sign-up, optionally layer `custom/password-strength` onto the block's password field.

**Other reuse:** `@tourism/ui` `dropdown-menu-custom` + `avatar-custom` (UserMenu), `button-custom`,
`alert-custom`. Existing Supabase + API wiring (§2). react-hook-form (7.77) + zod (4.4) already
present; add only `@hookform/resolvers`. Confirm exact prop shapes during implementation and adapt.

---

## 6. Error handling, security, edge cases

- **Open-redirect prevention:** `sanitizeReturnTo`/`next` accept only same-origin **relative** paths
  (must start with `/`, not `//` or a scheme); otherwise fall back to `/`. Unit-tested.
- **Supabase errors → friendly i18n:** invalid credentials, email already registered, email not
  confirmed (with resend option), weak password, rate-limited, expired/!invalid recovery link.
- **Sync failure:** surface an inline error + **retry**; do NOT sign the user out and do NOT block
  the session (the Supabase session is valid; the local row can be re-synced). Never log tokens.
- **Tokens/cookies:** rely on `@supabase/ssr` httpOnly cookies; the access token for `/auth/sync` is
  read server-side in the action, never exposed to client logs.
- All states localized; no flow may crash the page (errors render in `alert-custom`).

---

## 7. Testing (Vitest + RTL, Supabase mocked, ≥80% on new logic)

- `schemas.ts` — email/password validation (valid, too-short, mismatch confirm, invalid email).
- `redirect.ts` — `sanitizeReturnTo` allows `/foo`, rejects `//evil`, `https://evil`, empty → `/`.
- `actions.ts` — `syncUser` calls `createApiClient(token)` `POST /auth/sync`; surfaces error on failure (api mocked).
- `auth-error.ts` — known Supabase error codes/messages map to the right i18n key; unknown → generic.

The four form components are thin orchestration wrappers (RHF + supabase call + redirect) over the
already-tested logic; per B-phase precedent they are **verified in the browser at DoD** rather than
unit-tested with heavy supabase/next-intl/navigation mocks. The ≥80% target applies to the logic
modules above. (A render/validation test can be added later if a form grows real branching.)

Playwright E2E deferred (manual browser verification at DoD instead).

---

## 8. Verification (Definition of Done for C1)

1. `pnpm --filter @tourism/web typecheck` clean; `pnpm --filter @tourism/web lint` (no new errors);
   `pnpm --filter @tourism/web test` green, ≥80% on new logic.
2. With backend (`pnpm --filter @tourism/api start:dev`) + web (`pnpm --filter @tourism/web dev`):
   - `/en/sign-up` creates an account; confirm-email ON → "check your email", clicking the link
     lands signed-in via `/auth/callback`; confirm-email OFF → signed-in immediately. A local user
     row exists (sync ran — verify via `/users/me` returning 200, or DB).
   - `/en/sign-in` signs in and redirects to `returnTo` ‖ `/`; wrong password shows a friendly error.
   - `/en/forgot-password` → email → `/reset-password` updates the password → can sign in with it.
   - `UserMenu` shows the email + a working **Sign out**; signed-in user visiting `/sign-in` is
     redirected to `/`.
   - `/vi/...` localized; `?returnTo=/tours` round-trips; bad `returnTo` falls back to `/`.
   - No console errors.
3. Seams verified present (not built): `/auth/callback` + `returnTo` ready for C3 Google; sign-in
   AAL seam noted for C4 2FA; `UserMenu` Account link ready for C2.
