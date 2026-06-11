# Customer FE — 2FA TOTP (C4) — Design Spec

**Date:** 2026-06-11
**Branch:** `feat/customer-fe-2fa-totp`
**App:** `apps/web` (customer, Next.js 16 App Router, port 3001)
**Status:** Approved (design), pending implementation plan

> Final C-phase feature: TOTP two-factor auth via supabase-js
> (`mfa.enroll/challenge/verify/unenroll/listFactors/getAuthenticatorAssuranceLevel`). A new
> `/account/security` page manages enrollment; the C1 sign-in form gains a second TOTP step for
> password sign-ins. Backend unchanged (pure verify-JWT + mirror layer — aal2 JWTs verify like any
> other). Also fixes a latent C1 bug found during design: Supabase TOTP error messages containing
> "invalid" would be mis-mapped to `errors.linkInvalid` by `mapAuthError`'s generic substring check.

---

## 1. Goal & Scope

Let customers enable, use, and remove TOTP 2FA with an authenticator app.

**Brainstorm decisions (locked):**

- **Placement:** dedicated **`/account/security`** route; `AccountShell` nav gains a second item
  (Profile / Security) as designed for in C2.
- **Enforcement:** **challenge at password sign-in only.** After `signInWithPassword`, if the user
  has a verified factor (AAL check), show a TOTP code step before completing. **Google OAuth
  sign-ins are NOT challenged** (delegated to Google's own 2FA — standard industry practice).
  No app-wide AAL2 page guards.
- **Factor scope:** **max 1 TOTP factor**, no recovery codes (Supabase has none built-in). Lost
  device → admin removes the factor in the Supabase dashboard. No SMS/phone factor.
- **Approach:** client-driven via `createSupabaseBrowserClient()` (standard documented flow);
  `verify` upgrades the browser session to `aal2` automatically.

**In scope:**

- `app/[locale]/(site)/account/security/page.tsx` (RSC guard, thin) + loading skeleton.
- `AccountShell` nav upgrade: `active: "profile" | "security"` prop, two localized `Link` items,
  `aria-current` on the active one. `/account` passes `active="profile"`.
- `features/account/MfaSection.tsx` (client): status load + enroll flow (QR/secret/code) +
  unenroll flow (code-gated).
- `SignInForm` two-step state machine (`credentials` → `totp`).
- Pure helpers (TDD): `shouldChallengeMfa`, `pickTotpFactor`; `mapAuthError` TOTP-message fix.
- i18n `Account.security.*`, `Auth.mfa.*`, `Auth.errors.mfaCodeInvalid` (EN/VI).
- E2E browser verification with programmatic TOTP code generation (no phone needed).

**Out of scope (unchanged / deferred):**

- Backend changes; recovery/backup codes; SMS factor; multiple factors per user.
- AAL2 enforcement on protected pages / a standalone `/mfa-challenge` page (OAuth sessions stay
  aal1 by design).
- Admin-side factor management UI (Supabase dashboard suffices).
- Visual polish (later whole-product redesign pass). Theme tokens only, reuse `@tourism/ui`.

---

## 2. Components & data flow

### 2.1 `/account/security` page (RSC)

Mirrors `/account`'s guard exactly: `getUser()` → signed-out redirects to
`/sign-in?returnTo=/account/security` (object-href form). No profile fetch needed — renders
`AccountShell active="security"` wrapping `<MfaSection />`. `loading.tsx` shimmer matches the C2
skeleton shape.

### 2.2 `AccountShell` upgrade (modify C2 component)

```tsx
export async function AccountShell({ active, children }: { active: "profile" | "security"; children: ReactNode })
```

Nav renders two `<li>` items using `Link` from `@/i18n/navigation`: Profile → `/account`,
Security → `/account/security`. The active item gets `aria-current="page"` + the existing
border-primary styling; the inactive one is a plain link with muted styling. i18n keys
`Account.nav.profile` (exists) + `Account.nav.security` (new). `/account/page.tsx` updated to pass
`active="profile"`.

### 2.3 `MfaSection` (client component, `features/account/MfaSection.tsx`)

State machine: `loading → disabled | enabled | enrolling | confirmingRemoval`, plus inline error.

- **Mount:** `supabase.auth.mfa.listFactors()` → `pickTotpFactor(factors)` → `enabled`/`disabled`.
- **Enroll** (`disabled` → click "Enable 2FA"): `mfa.enroll({ factorType: "totp" })` → render
  `totp.qr_code` (SVG data URI in an `<img>`), the `totp.secret` as selectable text fallback, and
  a 6-digit code input. Submit → `mfa.challenge({ factorId })` → `mfa.verify({ factorId,
  challengeId, code })`. Success → `enabled` (session is now aal2). Wrong code → inline error
  (`errors.mfaCodeInvalid`), retry allowed. **Cancel → `mfa.unenroll({ factorId })`** to clean up
  the unverified factor, back to `disabled`.
- **Unenroll** (`enabled` → click "Remove 2FA"): always code-gated — `challenge` + `verify`
  against the existing factor (guarantees aal2 even for Google/aal1 sessions), then
  `mfa.unenroll({ factorId })` → `disabled`. Wrong code → inline error, retry.
- Re-runs `listFactors` after enroll/unenroll to re-sync. Shimmer while `loading`.

### 2.4 Sign-in TOTP step (modify `SignInForm`)

Two-step state machine: `step: "credentials" | "totp"`.

- `credentials` (existing UI/logic): on `signInWithPassword` success, call
  `mfa.getAuthenticatorAssuranceLevel()`. If `shouldChallengeMfa(aal)` → `listFactors` →
  `pickTotpFactor` → store factor id, switch to `totp` step. Else → existing path (`syncUser` →
  hard-nav).
- `totp`: heading + 6-digit code input + verify button (+ "back to sign-in" reset). Submit →
  `mfa.challenge` + `mfa.verify`. Success → `syncUser()` → hard-nav `/${locale}${returnTo}`
  (identical completion to the password path). Wrong code → `errors.mfaCodeInvalid`, retry.
- Edge: factor list empty despite `shouldChallengeMfa` (race after admin removal) → fall through
  to the normal completion path.

### 2.5 Pure helpers (TDD — in `features/auth/mfa.ts`)

```ts
export interface AalLevels { currentLevel: string | null; nextLevel: string | null }
export function shouldChallengeMfa(aal: AalLevels | null): boolean
// true iff nextLevel === "aal2" && currentLevel !== "aal2"

export interface TotpFactorLike { id: string; status: string; factor_type?: string }
export function pickTotpFactor(factors: { totp?: TotpFactorLike[] } | null): TotpFactorLike | null
// first factor in `totp` with status === "verified", else null
```

### 2.6 `mapAuthError` TOTP fix (modify `features/auth/auth-error.ts`)

Supabase wrong-code errors ("Invalid TOTP code entered") contain "invalid" → today they'd hit the
generic `msg.includes("invalid") → errors.linkInvalid` branch. Add **before** that line:
`if (msg.includes("totp") || msg.includes("mfa")) return "errors.mfaCodeInvalid";` (preserving the
existing ordering note discipline). TDD via `auth-error.test.ts`.

---

## 3. i18n (EN/VI)

- `Account.nav.security` — "Security" / "Bảo mật".
- `Account.security.*`: `title`, `description`, `statusEnabled`, `statusDisabled`, `enableCta`,
  `removeCta`, `enrollTitle`, `enrollHelp` (scan QR or enter secret), `secretLabel`, `codeLabel`,
  `codePlaceholder`, `verifyCta`, `cancelCta`, `removeTitle`, `removeHelp` (enter current code to
  remove), `removeConfirmCta`, `enabledAt` (optional factor created date), `genericError`.
- `Auth.mfa.*`: `title` ("Two-factor code"), `help` (enter the 6-digit code from your app),
  `codeLabel`, `verifyCta`, `back`.
- `Auth.errors.mfaCodeInvalid` — "That code didn't work. Check your authenticator app and try
  again." / VI tương đương.
- Exact final wording set at implementation; all user-visible strings via keys, EN/VI parity.

---

## 4. Testing

**TDD (pure logic):**

- `mfa.test.ts`: `shouldChallengeMfa` (aal1→aal2 true; aal2→aal2 false; null/missing false;
  nextLevel aal1 false), `pickTotpFactor` (verified picked; unverified skipped; empty/null → null).
- `auth-error.test.ts`: TOTP message → `errors.mfaCodeInvalid`; ORDERING — a message containing
  both "totp" and "invalid" must map to mfaCodeInvalid, and existing linkInvalid cases unchanged.

**Browser-verified (not unit-tested):** MfaSection flows, sign-in totp step, shell nav.

**E2E (programmatic TOTP — no phone):** during enroll the secret is shown; generate valid codes
with a small Node script (RFC 6238 HMAC-SHA1 via built-in `crypto`). Verify:
1. `/account/security` signed-out → `sign-in?returnTo=/account/security`.
2. Enroll: QR + secret render → wrong code rejected (mfaCodeInvalid) → correct code → enabled.
3. Sign out → password sign-in → TOTP step appears → wrong code rejected → correct code → lands
   on `/{locale}{returnTo}`; user menu works; `/account` loads.
4. Google OAuth sign-in (same user) → NO challenge (by design).
5. Unenroll: requires current code → removed → password sign-in no longer challenges.
6. EN + VI for the security page and sign-in step; console clean.

**Config check:** Supabase Dashboard → Authentication → Multi-Factor: confirm TOTP enabled
(default on all plans; no Google Cloud involvement). If disabled, toggle on — no code impact.

---

## 5. Files (planned)

**New:**
- `apps/web/src/app/[locale]/(site)/account/security/page.tsx` + `loading.tsx`
- `apps/web/src/features/account/MfaSection.tsx`
- `apps/web/src/features/auth/mfa.ts` (+ `mfa.test.ts`)

**Modified:**
- `apps/web/src/features/account/AccountShell.tsx` (active prop + 2-item nav)
- `apps/web/src/app/[locale]/(site)/account/page.tsx` (pass `active="profile"`)
- `apps/web/src/features/auth/sign-in-form.tsx` (two-step totp)
- `apps/web/src/features/auth/auth-error.ts` (+ totp/mfa mapping) and `auth-error.test.ts`
- `apps/web/messages/en.json`, `vi.json`
- `docs/planning/roadmap.md` (mark C4 + Phase C complete at the end)

---

## 6. Risks / notes

- **OAuth sessions stay aal1** even when 2FA is enabled — accepted scope decision (Google's own
  2FA covers that path). Revisit only if app-wide AAL guards become a requirement.
- **Unverified factor cleanup:** Supabase keeps unverified factors; enroll-cancel unenrolls them.
  An abandoned tab (no cancel) can still leave one — next enroll attempt must handle an existing
  unverified factor (unenroll it first, then enroll fresh).
- **`mapAuthError` ordering** is load-bearing (totp check before generic "invalid") — guarded by
  tests.
- **Session refresh after verify:** supabase-js persists the upgraded aal2 session in cookies via
  `@supabase/ssr` automatically; the subsequent `syncUser()`/hard-nav flow is unchanged.
- Orphan dev servers on 3000/3001: same handling as prior phases.
