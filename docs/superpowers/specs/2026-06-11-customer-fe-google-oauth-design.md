# Customer FE — Google OAuth (C3) — Design Spec

**Date:** 2026-06-11
**Branch:** `feat/customer-fe-google-oauth`
**App:** `apps/web` (customer, Next.js 16 App Router, port 3001)
**Status:** Approved (design), pending implementation plan

> Wires the inert C1 `GoogleButton` seam into a real **"Continue with Google"** flow via
> `supabase.auth.signInWithOAuth` — reusing the existing non-localized `/auth/callback` route
> (`exchangeCodeForSession` → `syncUser` → sanitized redirect) unchanged in shape. Backend stays a
> pure verify-JWT + mirror layer per the standing decision (auth stays on Supabase). Also fixes a
> pre-existing C1 gap discovered during design: the callback emits `?error=link` on failure but
> **nothing reads it** — sign-in shows no error. C3 makes sign-in display callback error flags.

---

## 1. Goal & Scope

Let customers sign in / sign up with Google from the existing auth pages. One new external
dependency: the Google provider must be configured in Google Cloud Console + Supabase Dashboard
(deliberately staged AFTER code — see §6).

**Brainstorm decisions (locked):**
- **Approach:** client-side `signInWithOAuth({ provider: "google" })` from the button (standard
  supabase-js browser flow). No server action indirection, no Google SDK / One Tap.
- **Config staging:** code + unit tests first; Google Cloud + Supabase Dashboard config afterwards
  with step-by-step guidance, then full e2e browser verification.
- **Redirect:** preserve **both `returnTo` and locale** — the button builds
  `next=/{locale}{returnTo}` so a `/vi/sign-in?returnTo=/account` user lands back on `/vi/account`
  (consistent with the password flow's hard-nav to `/${locale}${returnTo}`).
- **Error UX:** dedicated **`?error=oauth`** flag (new i18n message) when Google fails or the user
  cancels at the consent screen; the legacy `?error=link` stays for no-code / exchange-failure.
  Sign-in renders both flags (fixing the C1 display gap).

**In scope:**
- Rewrite `features/auth/google-button.tsx` (live OAuth, loading state, inline error).
- Extend `app/auth/callback/route.ts` (detect provider `error` param; locale-aware error bounce).
- Sign-in form displays callback error flags (`link`, `oauth`).
- Pure helpers (TDD): `buildOAuthRedirect`, `pathLocale`, `mapCallbackError`.
- i18n: add `errors.oauthFailed`, `googleRedirecting`; remove `googleSoon` (EN/VI).
- Config runbook step-by-step (Google Cloud + Supabase Dashboard) + e2e verification.

**Out of scope (unchanged / deferred):**
- Any backend change (`/auth/sync` already handles OAuth users — it mirrors whatever Supabase JWT
  arrives).
- Other providers (Facebook/Apple…), Google One Tap, manual account-linking UI.
- 2FA / AAL (C4 seam untouched).
- Final visual polish (later whole-product redesign pass).

---

## 2. Components & data flow

### 2.1 `GoogleButton` (rewrite — `features/auth/google-button.tsx`)
`"use client"`. Drops the `{ label, soon }` props; reads everything itself like `sign-in-form.tsx`:
`useTranslations("Auth")`, `useLocale()`, `useSearchParams()` (+ `sanitizeReturnTo`).

Click handler:
1. `setPending(true)`, clear inline error.
2. `const redirectTo = buildOAuthRedirect(window.location.origin, locale, returnTo)`
   → `` `${origin}/auth/callback?next=${encodeURIComponent(`/${locale}${returnTo}`)}` ``.
3. `await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })`.
   On success the browser navigates away to Google; the pending state simply persists until unload.
4. If it returns an `error` (typically provider-not-enabled misconfig): `setPending(false)` and show
   `errors.oauthFailed` in a `<p role="alert">` under the button.

Button shows `googleCta` normally, `googleRedirecting` + disabled while pending. Both
`(auth)/sign-in/page.tsx` and `(auth)/sign-up/page.tsx` change to `<GoogleButton />` (no props).

### 2.2 Pure helpers (TDD — these carry the logic)
In `features/auth/`:
- **`buildOAuthRedirect(origin: string, locale: string, returnTo: string): string`** — new file
  `features/auth/oauth.ts`. Encodes `next` exactly once; `returnTo` is already sanitized by the
  caller.
- **`pathLocale(path: string): "en" | "vi" | null`** — in `redirect.ts` beside `sanitizeReturnTo`.
  Returns the first segment iff it is a known routing locale (uses `routing.locales`), else `null`.
- **`mapCallbackError(flag: string | null): string | null`** — in `auth-error.ts` beside
  `mapAuthError`. `"link"` → `"errors.linkInvalid"`, `"oauth"` → `"errors.oauthFailed"`, anything
  else → `null` (unknown flags show nothing).

### 2.3 Callback route (extend — `app/auth/callback/route.ts`)
Order of checks:
1. `const next = sanitizeReturnTo(url.searchParams.get("next"))` (unchanged).
2. **NEW:** if `url.searchParams.get("error")` is present (Google/Supabase provider error or user
   cancel), redirect to `${localePrefix}/sign-in?error=oauth` where
   `localePrefix = pathLocale(next) ? "/" + pathLocale(next) : ""` — a VI user who cancels returns
   to `/vi/sign-in`, not `/en`. (Non-prefixed paths fall through to middleware default, as today.)
3. Existing: `code` present → `exchangeCodeForSession` → `syncUser` (best-effort, logged) →
   redirect to `next`. Since the Google flow now passes `next=/{locale}{returnTo}`, the success
   redirect is locale-correct without middleware guessing. Email flows keep passing non-localized
   `next` values — unchanged behavior.
4. Existing fallback: no code / exchange failed → `sign-in?error=link`, now also locale-prefixed
   via the same `pathLocale(next)` logic.

### 2.4 Sign-in error display (fix C1 gap — `features/auth/sign-in-form.tsx`)
The form already has `formError` state + `sp = useSearchParams()`. Initialize:
`const callbackErrorKey = mapCallbackError(sp.get("error"))` and seed the rendered error with
`t(callbackErrorKey)` when present (cleared on next submit attempt, as today). No new UI — reuses
the existing `role="alert"` paragraph.

### 2.5 Account behavior notes (no code)
- New Google user → Supabase creates the user with a verified email → callback exchanges code →
  `syncUser` mirrors into the local DB with role `CUSTOMER`. No FE branching needed.
- Supabase default: a Google identity with the **same verified email** as an existing
  email/password user is **linked automatically** — no linking UI required.

---

## 3. i18n (`Auth` namespace, EN/VI)

- **Add** `errors.oauthFailed` — EN "Google sign-in failed. Please try again." / VI "Đăng nhập
  Google thất bại. Vui lòng thử lại."
- **Add** `googleRedirecting` — EN "Redirecting to Google…" / VI "Đang chuyển hướng tới Google…".
- **Remove** `googleSoon` (both files; no remaining references after the button rewrite).
- `googleCta`, `errors.linkInvalid` unchanged.

---

## 4. Testing

**TDD (pure logic):**
- `buildOAuthRedirect` — exact URL shape, single encoding, locale+returnTo composition, root
  returnTo (`/`) case.
- `pathLocale` — `/vi/account` → `"vi"`, `/en` → `"en"`, `/account` → `null`, `/fr/x` → `null`,
  `/` → `null`.
- `mapCallbackError` — `link`/`oauth`/unknown/null cases.
- Existing `redirect.test.ts` / `auth-error.test.ts` suites extended in place where the helpers
  live.

**Not unit-tested (browser-verified):** the button's click→redirect side effect, the callback
route end-to-end, sign-in error rendering.

**Browser verification — stage 1 (pre-config):** button enabled with correct label EN/VI; click
shows the OAuth-failed inline error (provider not enabled — expected); no console errors;
`sign-in?error=oauth` and `?error=link` render their messages on EN+VI sign-in.

**Browser verification — stage 2 (post-config, e2e):** full Google sign-in from `/en` and `/vi`
(locale + returnTo preserved, e.g. via `/vi/account` guard redirect → Google → back on
`/vi/account`); consent-screen cancel → `/{locale}/sign-in?error=oauth` with message; brand-new
Google account → user mirrored (role CUSTOMER) and `/account` loads; existing-email linking sanity
check.

---

## 5. Files (planned)

**Modified:**
- `apps/web/src/features/auth/google-button.tsx` (rewrite)
- `apps/web/src/features/auth/redirect.ts` (+ `pathLocale`) and `redirect.test.ts`
- `apps/web/src/features/auth/auth-error.ts` (+ `mapCallbackError`) and `auth-error.test.ts`
- `apps/web/src/features/auth/sign-in-form.tsx` (callback error display)
- `apps/web/src/app/auth/callback/route.ts` (provider error + locale-aware bounces)
- `apps/web/src/app/[locale]/(auth)/sign-in/page.tsx`, `sign-up/page.tsx` (`<GoogleButton />`)
- `apps/web/messages/en.json`, `vi.json`
- `docs/planning/roadmap.md` (mark C3 at the end)

**New:**
- `apps/web/src/features/auth/oauth.ts` (+ `oauth.test.ts`) — `buildOAuthRedirect`

---

## 6. Config runbook (post-code, guided)

1. **Google Cloud Console** — create/select project → OAuth consent screen (External, app name,
   support email) → Credentials → Create OAuth client ID (Web application) → Authorized redirect
   URI: `https://<project-ref>.supabase.co/auth/v1/callback` → copy Client ID + Secret.
2. **Supabase Dashboard** — Authentication → Providers → Google → enable, paste Client ID/Secret.
3. **Supabase URL allow-list** — Authentication → URL Configuration → add
   `http://localhost:3001/auth/callback` (and later the production callback URL).
4. Then run stage-2 e2e verification (§4). No app env vars change — `signInWithOAuth` uses the
   existing `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`.

---

## 7. Risks / notes

- **Provider-not-enabled until config:** by design (staged). Stage-1 verification asserts the
  graceful inline error path instead.
- **`next` trust:** still funneled through `sanitizeReturnTo` (open-redirect safe); `pathLocale`
  only ever returns a value from `routing.locales`, so the error-bounce prefix cannot be injected.
- **Email-flow regression risk:** callback changes are additive (new `error` branch + locale
  prefix on bounces); the success path for email verify/recovery links is untouched. Stage-1
  verification re-checks `?error=link` rendering; existing C1 flows (sign-up verify, reset) get a
  quick browser sanity pass.
- **Orphan dev servers on 3000/3001:** same handling as prior phases (kill PID on EADDRINUSE,
  clear `apps/web/.next` after branch switches).
