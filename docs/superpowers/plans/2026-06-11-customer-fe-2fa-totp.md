# Customer FE — 2FA TOTP (C4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TOTP 2FA — a `/account/security` page to enroll/remove an authenticator factor, and a second TOTP step in the password sign-in flow; Google OAuth sign-ins are not challenged.

**Architecture:** Client-driven supabase-js MFA (`mfa.enroll/challenge/verify/unenroll/listFactors/getAuthenticatorAssuranceLevel`); `verify` upgrades the session to aal2 and `@supabase/ssr` persists it. Decision logic lives in TDD'd pure helpers (`shouldChallengeMfa`, `pickTotpFactor`); a latent `mapAuthError` bug (TOTP errors mis-mapped to `linkInvalid`) is fixed with ordering-guarded tests. `AccountShell` nav grows its second item as designed in C2.

**Tech Stack:** Next.js 16 App Router, supabase-js v2 MFA API, next-intl EN/VI, RHF (credentials step only), Vitest. No new dependencies (TOTP codes for e2e are generated with Node built-in `crypto`).

**Conventions:** tests `pnpm --filter @tourism/web test`; typecheck/lint same filter; theme tokens only; no `console.log`. Spec: `docs/superpowers/specs/2026-06-11-customer-fe-2fa-totp-design.md`.

**File structure (all under `apps/web/src/` unless noted):**
- `features/auth/mfa.ts` (+ `mfa.test.ts`) — NEW pure helpers.
- `features/auth/auth-error.ts` (+ test) — TOTP message mapping fix.
- `features/account/MfaSection.tsx` — NEW client MFA manager.
- `features/account/AccountShell.tsx` — `active` prop + 2-item nav.
- `app/[locale]/(site)/account/page.tsx` — pass `active="profile"`.
- `app/[locale]/(site)/account/security/page.tsx` + `loading.tsx` — NEW.
- `features/auth/sign-in-form.tsx` — two-step totp.
- `messages/en.json`, `vi.json` — new keys.
- `docs/planning/roadmap.md` — final task.

---

## Task 1: Pure helpers `features/auth/mfa.ts`

**Files:**
- Create: `apps/web/src/features/auth/mfa.ts`
- Test: `apps/web/src/features/auth/mfa.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/features/auth/mfa.test.ts
import { describe, it, expect } from "vitest";
import { shouldChallengeMfa, pickTotpFactor } from "./mfa";

describe("shouldChallengeMfa", () => {
  it("is true when the session must step up to aal2", () => {
    expect(shouldChallengeMfa({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
  });
  it("is false when already aal2", () => {
    expect(shouldChallengeMfa({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
  });
  it("is false when no factor is enrolled (next stays aal1)", () => {
    expect(shouldChallengeMfa({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
  });
  it("is false for null/missing input", () => {
    expect(shouldChallengeMfa(null)).toBe(false);
    expect(shouldChallengeMfa({ currentLevel: null, nextLevel: null })).toBe(false);
  });
});

describe("pickTotpFactor", () => {
  const verified = { id: "f1", status: "verified" };
  const unverified = { id: "f2", status: "unverified" };
  it("picks the first verified totp factor", () => {
    expect(pickTotpFactor({ totp: [unverified, verified] })).toEqual(verified);
  });
  it("returns null when no verified factor exists", () => {
    expect(pickTotpFactor({ totp: [unverified] })).toBe(null);
    expect(pickTotpFactor({ totp: [] })).toBe(null);
    expect(pickTotpFactor({})).toBe(null);
    expect(pickTotpFactor(null)).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tourism/web test -- mfa.test`
Expected: FAIL — cannot resolve `./mfa`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/features/auth/mfa.ts
/** Shape of supabase `mfa.getAuthenticatorAssuranceLevel()` data we read. */
export interface AalLevels {
  currentLevel: string | null;
  nextLevel: string | null;
}

/** True iff the session must step up to aal2 (a verified factor exists). */
export function shouldChallengeMfa(aal: AalLevels | null): boolean {
  return aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";
}

/** Minimal factor shape we read off supabase `mfa.listFactors()` data. */
export interface TotpFactorLike {
  id: string;
  status: string;
}

/** First VERIFIED totp factor, or null. Unverified leftovers are ignored. */
export function pickTotpFactor(
  factors: { totp?: TotpFactorLike[] } | null,
): TotpFactorLike | null {
  return factors?.totp?.find((f) => f.status === "verified") ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tourism/web test -- mfa.test`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth/mfa.ts apps/web/src/features/auth/mfa.test.ts
git commit -m "feat(web): mfa pure helpers (shouldChallengeMfa, pickTotpFactor)"
```

---

## Task 2: `mapAuthError` TOTP fix

**Files:**
- Modify: `apps/web/src/features/auth/auth-error.ts` (inside `mapAuthError`)
- Test: `apps/web/src/features/auth/auth-error.test.ts` (append cases)

- [ ] **Step 1: Write the failing test** — append inside the existing `describe("mapAuthError")`:

```ts
  it("maps TOTP/MFA errors before the generic 'invalid' branch", () => {
    expect(mapAuthError({ message: "Invalid TOTP code entered" })).toBe("errors.mfaCodeInvalid");
    expect(mapAuthError({ message: "MFA verification failed" })).toBe("errors.mfaCodeInvalid");
  });
  it("keeps mapping plain link errors to linkInvalid", () => {
    expect(mapAuthError({ message: "Token has expired or is invalid" })).toBe("errors.linkInvalid");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tourism/web test -- auth-error.test`
Expected: FAIL — "Invalid TOTP code entered" currently returns `errors.linkInvalid`.

- [ ] **Step 3: Implement** — in `mapAuthError`, add ABOVE the `expired/invalid` line (keep the ordering note accurate):

```ts
  // MUST run before the generic `invalid` check — TOTP errors contain "invalid".
  if (msg.includes("totp") || msg.includes("mfa")) return "errors.mfaCodeInvalid";
  if (msg.includes("expired") || msg.includes("invalid")) return "errors.linkInvalid";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tourism/web test -- auth-error.test`
Expected: PASS (all existing + new).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth/auth-error.ts apps/web/src/features/auth/auth-error.test.ts
git commit -m "fix(web): map TOTP/MFA errors before generic invalid branch"
```

---

## Task 3: i18n keys (EN/VI)

**Files:**
- Modify: `apps/web/messages/en.json`, `apps/web/messages/vi.json`

- [ ] **Step 1: en.json** — in `Auth`: add to `errors`: `"mfaCodeInvalid": "That code didn't work. Check your authenticator app and try again."`; add sibling object after `googleRedirecting`:

```json
"mfa": {
  "title": "Two-factor code",
  "help": "Enter the 6-digit code from your authenticator app.",
  "codeLabel": "Authentication code",
  "verifyCta": "Verify",
  "back": "Back to sign in"
}
```

In `Account`: add `"security": "Security"` inside `nav`, and a new top-level-in-namespace object:

```json
"security": {
  "title": "Two-factor authentication",
  "description": "Add an extra verification step when signing in with your password.",
  "statusEnabled": "Two-factor authentication is on.",
  "statusDisabled": "Two-factor authentication is off.",
  "enableCta": "Enable 2FA",
  "removeCta": "Remove 2FA",
  "enrollTitle": "Set up your authenticator app",
  "enrollHelp": "Scan the QR code with your authenticator app, or enter the secret manually, then enter the 6-digit code it shows.",
  "qrAlt": "QR code for your authenticator app",
  "secretLabel": "Setup key",
  "codeLabel": "6-digit code",
  "verifyCta": "Verify and enable",
  "cancelCta": "Cancel",
  "removeTitle": "Remove two-factor authentication",
  "removeHelp": "Enter the current code from your authenticator app to confirm removal.",
  "removeConfirmCta": "Confirm removal",
  "genericError": "Something went wrong. Please try again."
}
```

- [ ] **Step 2: vi.json** — same shapes:

```json
"mfaCodeInvalid": "Mã không đúng. Kiểm tra ứng dụng xác thực và thử lại."
```

```json
"mfa": {
  "title": "Mã xác thực hai lớp",
  "help": "Nhập mã 6 số từ ứng dụng xác thực của bạn.",
  "codeLabel": "Mã xác thực",
  "verifyCta": "Xác minh",
  "back": "Quay lại đăng nhập"
}
```

```json
"security": "Bảo mật"
```

```json
"security": {
  "title": "Xác thực hai lớp",
  "description": "Thêm một bước xác minh khi đăng nhập bằng mật khẩu.",
  "statusEnabled": "Xác thực hai lớp đang bật.",
  "statusDisabled": "Xác thực hai lớp đang tắt.",
  "enableCta": "Bật 2FA",
  "removeCta": "Gỡ 2FA",
  "enrollTitle": "Thiết lập ứng dụng xác thực",
  "enrollHelp": "Quét mã QR bằng ứng dụng xác thực, hoặc nhập khóa thủ công, rồi nhập mã 6 số ứng dụng hiển thị.",
  "qrAlt": "Mã QR cho ứng dụng xác thực",
  "secretLabel": "Khóa thiết lập",
  "codeLabel": "Mã 6 số",
  "verifyCta": "Xác minh và bật",
  "cancelCta": "Hủy",
  "removeTitle": "Gỡ xác thực hai lớp",
  "removeHelp": "Nhập mã hiện tại từ ứng dụng xác thực để xác nhận gỡ.",
  "removeConfirmCta": "Xác nhận gỡ",
  "genericError": "Đã xảy ra lỗi. Vui lòng thử lại."
}
```

NOTE: `Account.nav` gains `security`; the `Account.security` object sits beside `nav`/`identity`. Key parity EN↔VI required.

- [ ] **Step 3: Validate**

```bash
node -e "for (const l of ['en','vi']) { const j=require('./apps/web/messages/'+l+'.json'); if(!j.Auth.mfa.title||!j.Auth.errors.mfaCodeInvalid||!j.Account.nav.security||!j.Account.security.enableCta) throw new Error(l); } console.log('ok')"
```

Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/en.json apps/web/messages/vi.json
git commit -m "feat(web): Account security + Auth mfa i18n keys (EN/VI)"
```

---

## Task 4: `AccountShell` active prop + `/account` update

**Files:**
- Modify: `apps/web/src/features/account/AccountShell.tsx`
- Modify: `apps/web/src/app/[locale]/(site)/account/page.tsx` (the `<AccountShell>` usages)

- [ ] **Step 1: Rewrite AccountShell**

```tsx
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type AccountSection = "profile" | "security";

const NAV_ITEMS: { section: AccountSection; href: "/account" | "/account/security"; labelKey: "nav.profile" | "nav.security" }[] = [
  { section: "profile", href: "/account", labelKey: "nav.profile" },
  { section: "security", href: "/account/security", labelKey: "nav.security" },
];

/**
 * Thin account layout: heading + a minimal nav list + single content column.
 * Structured so Phase D (e.g. Bookings) can append nav items without
 * re-architecting. Not a sidebar.
 *
 * Note: the (site) layout wraps content in a plain <div>, not a <main>, so
 * this component uses <main> safely with no landmark nesting violation.
 */
export async function AccountShell({
  active,
  children,
}: {
  active: AccountSection;
  children: ReactNode;
}) {
  const t = await getTranslations("Account");
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </header>
      <nav aria-label={t("title")} className="mb-6">
        <ul className="flex gap-4 border-b border-border">
          {NAV_ITEMS.map((item) =>
            item.section === active ? (
              <li key={item.section}>
                <span
                  aria-current="page"
                  className="inline-block border-b-2 border-primary px-1 pb-2 text-sm font-medium text-foreground"
                >
                  {t(item.labelKey)}
                </span>
              </li>
            ) : (
              <li key={item.section}>
                <Link
                  href={item.href}
                  className="inline-block px-1 pb-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  {t(item.labelKey)}
                </Link>
              </li>
            ),
          )}
        </ul>
      </nav>
      <div>{children}</div>
    </main>
  );
}
```

- [ ] **Step 2: Update `/account/page.tsx`** — both `<AccountShell>` occurrences (success + error fallback) become `<AccountShell active="profile">`.

- [ ] **Step 3: Typecheck + tests**

Run: `pnpm --filter @tourism/web typecheck && pnpm --filter @tourism/web test`
Expected: clean / all pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/account/AccountShell.tsx "apps/web/src/app/[locale]/(site)/account/page.tsx"
git commit -m "feat(web): AccountShell active-aware 2-item nav (profile/security)"
```

---

## Task 5: `MfaSection` client component

**Files:**
- Create: `apps/web/src/features/account/MfaSection.tsx`

- [ ] **Step 1: Implement** (verify `@tourism/ui` props against sources as in C2/C3; all named exports below were confirmed in C2):

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@tourism/ui/components/custom/button-custom";
import { Alert, AlertDescription } from "@tourism/ui/components/custom/alert-custom";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@tourism/ui/components/legacy/field";
import { Input } from "@tourism/ui/components/legacy/input";
import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { pickTotpFactor, type TotpFactorLike } from "@/features/auth/mfa";
import { mapAuthError } from "@/features/auth/auth-error";

type View =
  | { kind: "loading" }
  | { kind: "disabled" }
  | { kind: "enrolling"; factorId: string; qrCode: string; secret: string }
  | { kind: "enabled"; factor: TotpFactorLike }
  | { kind: "removing"; factor: TotpFactorLike };

/**
 * Manages the user's single TOTP factor: status, enroll (QR + secret + code
 * verify), and code-gated removal (challenge+verify guarantees aal2 even for
 * OAuth sessions before unenroll).
 */
export function MfaSection() {
  const t = useTranslations("Account");
  const [view, setView] = useState<View>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(t("security.genericError"));
      setView({ kind: "disabled" });
      return;
    }
    const factor = pickTotpFactor(data);
    setView(factor ? { kind: "enabled", factor } : { kind: "disabled" });
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function resetTransient() {
    setCode("");
    setError(null);
  }

  async function startEnroll() {
    resetTransient();
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    // Clean up an abandoned unverified factor from a previous attempt.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    const stale = existing?.totp?.find((f) => f.status !== "verified");
    if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id });

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (enrollError || !data) {
      setError(t("security.genericError"));
      return;
    }
    setView({ kind: "enrolling", factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verifyCode(factorId: string): Promise<boolean> {
    const supabase = createSupabaseBrowserClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setError(t("security.genericError"));
      return false;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError(t(`${mapAuthError(verifyError)}` as never) ?? t("security.genericError"));
      return false;
    }
    return true;
  }

  async function confirmEnroll() {
    if (view.kind !== "enrolling") return;
    setError(null);
    setBusy(true);
    const ok = await verifyCode(view.factorId);
    setBusy(false);
    if (ok) {
      resetTransient();
      setView({ kind: "loading" });
      await refresh();
    }
  }

  async function cancelEnroll() {
    if (view.kind !== "enrolling") return;
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.mfa.unenroll({ factorId: view.factorId });
    setBusy(false);
    resetTransient();
    setView({ kind: "disabled" });
  }

  async function confirmRemove() {
    if (view.kind !== "removing") return;
    setError(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const ok = await verifyCode(view.factor.id);
    if (!ok) {
      setBusy(false);
      return;
    }
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: view.factor.id });
    setBusy(false);
    if (unenrollError) {
      setError(t("security.genericError"));
      return;
    }
    resetTransient();
    setView({ kind: "loading" });
    await refresh();
  }

  if (view.kind === "loading") {
    return (
      <div className="space-y-3">
        <ShimmerSkeleton className="h-6 w-56" />
        <ShimmerSkeleton className="h-10 w-full" />
        <ShimmerSkeleton className="h-10 w-32" />
      </div>
    );
  }

  return (
    <section aria-label={t("security.title")} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{t("security.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("security.description")}</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {view.kind === "disabled" && (
        <div className="space-y-3">
          <p className="text-sm text-foreground">{t("security.statusDisabled")}</p>
          <Button type="button" onClick={startEnroll} disabled={busy}>
            {t("security.enableCta")}
          </Button>
        </div>
      )}

      {view.kind === "enabled" && (
        <div className="space-y-3">
          <p className="text-sm text-foreground">{t("security.statusEnabled")}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetTransient();
              setView({ kind: "removing", factor: view.factor });
            }}
            disabled={busy}
          >
            {t("security.removeCta")}
          </Button>
        </div>
      )}

      {view.kind === "enrolling" && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <h3 className="font-medium text-foreground">{t("security.enrollTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("security.enrollHelp")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URI QR from Supabase */}
          <img src={view.qrCode} alt={t("security.qrAlt")} width={176} height={176} className="rounded bg-white p-2" />
          <div className="text-sm">
            <span className="text-muted-foreground">{t("security.secretLabel")}: </span>
            <code className="select-all break-all text-foreground">{view.secret}</code>
          </div>
          <FieldGroup className="gap-3">
            <Field className="gap-2">
              <FieldLabel htmlFor="mfa-code">{t("security.codeLabel")}</FieldLabel>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="button" onClick={confirmEnroll} disabled={busy || code.trim().length < 6}>
                {t("security.verifyCta")}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelEnroll} disabled={busy}>
                {t("security.cancelCta")}
              </Button>
            </div>
          </FieldGroup>
        </div>
      )}

      {view.kind === "removing" && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <h3 className="font-medium text-foreground">{t("security.removeTitle")}</h3>
          <FieldGroup className="gap-3">
            <Field className="gap-2">
              <FieldLabel htmlFor="mfa-remove-code">{t("security.codeLabel")}</FieldLabel>
              <Input
                id="mfa-remove-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <FieldDescription>{t("security.removeHelp")}</FieldDescription>
            </Field>
            <div className="flex gap-2">
              <Button type="button" variant="destructive" onClick={confirmRemove} disabled={busy || code.trim().length < 6}>
                {t("security.removeConfirmCta")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetTransient();
                  setView({ kind: "enabled", factor: view.factor });
                }}
                disabled={busy}
              >
                {t("security.cancelCta")}
              </Button>
            </div>
          </FieldGroup>
        </div>
      )}
    </section>
  );
}
```

Adjustment notes for the implementer: the `verifyCode` error line uses `mapAuthError(verifyError)` whose result is an `Auth.*` key — but `t` here is the `Account` namespace. FIX while implementing: create `const tAuth = useTranslations("Auth");` and use `setError(tAuth(mapAuthError(verifyError)))`. Confirm Button variants (`outline`/`ghost`/`destructive`) exist in button-custom; swap to existing variants if named differently.

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm --filter @tourism/web typecheck && pnpm --filter @tourism/web lint`
Expected: clean; zero new lint issues (the `no-img-element` disable comment covers the data-URI QR).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/account/MfaSection.tsx
git commit -m "feat(web): MfaSection enroll/remove TOTP manager"
```

---

## Task 6: `/account/security` page + loading

**Files:**
- Create: `apps/web/src/app/[locale]/(site)/account/security/page.tsx`
- Create: `apps/web/src/app/[locale]/(site)/account/security/loading.tsx`

- [ ] **Step 1: page.tsx**

```tsx
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AccountShell } from "@/features/account/AccountShell";
import { MfaSection } from "@/features/account/MfaSection";

export default async function AccountSecurityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: { pathname: "/sign-in", query: { returnTo: "/account/security" } }, locale });
  }

  return (
    <AccountShell active="security">
      <MfaSection />
    </AccountShell>
  );
}
```

- [ ] **Step 2: loading.tsx**

```tsx
import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";

export default function AccountSecurityLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <ShimmerSkeleton className="mb-2 h-9 w-48" />
      <ShimmerSkeleton className="mb-8 h-5 w-72" />
      <ShimmerSkeleton className="mb-3 h-6 w-56" />
      <ShimmerSkeleton className="mb-3 h-10 w-full" />
      <ShimmerSkeleton className="h-10 w-32" />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint + tests**

Run: `pnpm --filter @tourism/web typecheck && pnpm --filter @tourism/web lint && pnpm --filter @tourism/web test`
Expected: all clean/green.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/(site)/account/security/page.tsx" "apps/web/src/app/[locale]/(site)/account/security/loading.tsx"
git commit -m "feat(web): /account/security page (guarded) + skeleton"
```

---

## Task 7: Sign-in two-step TOTP

**Files:**
- Modify: `apps/web/src/features/auth/sign-in-form.tsx`

- [ ] **Step 1: Rewrite the component** (full new content — preserves all existing behavior for the credentials step):

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@tourism/ui/components/legacy/button";
import { Field, FieldGroup, FieldLabel } from "@tourism/ui/components/legacy/field";
import { Input } from "@tourism/ui/components/legacy/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { signInSchema, type SignInValues } from "./schemas";
import { sanitizeReturnTo } from "./redirect";
import { mapAuthError, mapCallbackError } from "./auth-error";
import { shouldChallengeMfa, pickTotpFactor } from "./mfa";
import { syncUser } from "./actions";
import { PasswordField } from "./password-field";

type Step = { kind: "credentials" } | { kind: "totp"; factorId: string };

export function SignInForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const sp = useSearchParams();
  const returnTo = sanitizeReturnTo(sp.get("returnTo"));
  // Seed the form error from a /auth/callback `?error=` flag (link/oauth);
  // cleared on the next submit attempt like any other form error.
  const callbackErrorKey = mapCallbackError(sp.get("error"));
  const [formError, setFormError] = useState<string | null>(
    callbackErrorKey ? t(callbackErrorKey) : null,
  );
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [totpCode, setTotpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  /** Shared tail of both steps: mirror the user, then hard-nav to the target. */
  async function completeSignIn() {
    const sync = await syncUser();
    if (!sync.ok) {
      setFormError(t("errors.syncFailed"));
      return;
    }
    window.location.assign(`/${locale}${returnTo}`);
  }

  async function onSubmit(values: SignInValues) {
    setFormError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setFormError(t(mapAuthError(error)));
      return;
    }
    // 2FA step-up: password sign-ins with a verified factor must verify a code.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (shouldChallengeMfa(aal ?? null)) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = pickTotpFactor(factors ?? null);
      if (factor) {
        setStep({ kind: "totp", factorId: factor.id });
        return;
      }
      // Factor vanished (e.g. admin removed it) — proceed normally.
    }
    await completeSignIn();
  }

  async function onVerifyTotp(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind !== "totp") return;
    setFormError(null);
    setVerifying(true);
    const supabase = createSupabaseBrowserClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: step.factorId,
    });
    if (challengeError || !challenge) {
      setVerifying(false);
      setFormError(t("errors.generic"));
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: step.factorId,
      challengeId: challenge.id,
      code: totpCode.trim(),
    });
    if (verifyError) {
      setVerifying(false);
      setFormError(t(mapAuthError(verifyError)));
      return;
    }
    await completeSignIn();
    setVerifying(false);
  }

  if (step.kind === "totp") {
    return (
      <form onSubmit={onVerifyTotp} noValidate>
        <FieldGroup className="gap-4">
          <div>
            <h2 className="font-medium text-card-foreground">{t("mfa.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("mfa.help")}</p>
          </div>
          {formError && (
            <p role="alert" className="text-destructive text-sm">
              {formError}
            </p>
          )}
          <Field className="gap-2">
            <FieldLabel htmlFor="totp-code">{t("mfa.codeLabel")}</FieldLabel>
            <Input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
            />
          </Field>
          <Field>
            <Button type="submit" className="w-full" disabled={verifying || totpCode.trim().length < 6}>
              {t("mfa.verifyCta")}
            </Button>
          </Field>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:underline"
            onClick={() => {
              setStep({ kind: "credentials" });
              setTotpCode("");
              setFormError(null);
            }}
          >
            {t("mfa.back")}
          </button>
        </FieldGroup>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        {formError && (
          <p role="alert" className="text-destructive text-sm">
            {formError}
          </p>
        )}
        <Field className="gap-2">
          <FieldLabel htmlFor="email">{t("emailLabel")}</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
          {errors.email?.message ? (
            <p id="email-error" role="alert" className="text-destructive text-sm">
              {t(errors.email.message)}
            </p>
          ) : null}
        </Field>
        <PasswordField
          id="password"
          label={t("passwordLabel")}
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          registration={register("password")}
          error={errors.password?.message ? t(errors.password.message) : undefined}
        />
        <Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {t("signInCta")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck + lint + full tests**

Run: `pnpm --filter @tourism/web typecheck && pnpm --filter @tourism/web lint && pnpm --filter @tourism/web test`
Expected: all green; zero new lint issues.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/auth/sign-in-form.tsx
git commit -m "feat(web): sign-in TOTP step (AAL step-up for password sign-ins)"
```

---

## Task 8: Verification + roadmap + merge gate

**Files:**
- Create (untracked tool): `.tmp/totp.mjs`
- Modify: `docs/planning/roadmap.md`

- [ ] **Step 1: Production build**

```bash
rm -rf apps/web/.next && pnpm --filter @tourism/web build
```

Expected: success; `/[locale]/account/security` appears as a dynamic route.

- [ ] **Step 2: TOTP generator for e2e** — write `.tmp/totp.mjs` (gitignored dir):

```js
// .tmp/totp.mjs — RFC 6238 TOTP (SHA1, 6 digits, 30s) from a base32 secret.
import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(s) {
  const clean = s.replace(/=+$/u, "").toUpperCase().replace(/[^A-Z2-7]/gu, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

const secret = process.argv[2];
if (!secret) {
  console.error("usage: node .tmp/totp.mjs <base32-secret>");
  process.exit(1);
}
const counter = Math.floor(Date.now() / 1000 / 30);
const buf = Buffer.alloc(8);
buf.writeBigUInt64BE(BigInt(counter));
const hmac = createHmac("sha1", base32Decode(secret)).update(buf).digest();
const offset = hmac[hmac.length - 1] & 0x0f;
const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
console.log(code);
```

Sanity: `node .tmp/totp.mjs JBSWY3DPEHPK3PXP` prints a 6-digit code.

- [ ] **Step 3: Start servers** (`pnpm --filter @tourism/api start:dev`, `pnpm --filter @tourism/web dev`; kill stale PIDs on EADDRINUSE).

- [ ] **Step 4: Supabase config check** — Dashboard → Authentication → Multi-Factor: TOTP enabled (default). If off, ask Yuri to toggle.

- [ ] **Step 5: E2E (Playwright + totp.mjs):**
1. Signed-out `/en/account/security` → `sign-in?returnTo=%2Faccount%2Fsecurity`; sign in (customer creds) → land back on security page; shell nav shows Profile + Security (Security active).
2. Enable 2FA → QR + secret render → capture secret → wrong code `000000` → `mfaCodeInvalid` error → `node .tmp/totp.mjs <secret>` → correct code → status enabled.
3. Sign out → password sign-in → TOTP step renders → wrong code rejected → fresh correct code → lands on home; `/account` loads.
4. VI pass: `/vi/account/security` labels + sign-in TOTP step copy.
5. Remove 2FA: requires current code → removed → sign out → password sign-in no longer challenges.
6. Console clean throughout (app pages).

- [ ] **Step 6: Roadmap** — replace the C4 row (`⬜ Not started`) with a ✅ row in C1–C3 style linking this spec+plan; ALSO flip the Phase C parent row (`Customer FE — C. Auth & Account`) from 🔶 In progress to ✅ Complete (C1→C4 all done).

```bash
git add docs/planning/roadmap.md
git commit -m "docs: mark C4 2FA TOTP done; Phase C complete"
```

- [ ] **Step 7: Final whole-branch review, then STOP** — present results and CONFIRM with Yuri before rebase-and-merge + push + branch deletion.

---

## Self-Review notes (author)

- **Spec coverage:** §2.1 page → Task 6; §2.2 shell → Task 4; §2.3 MfaSection → Task 5 (incl. stale-factor cleanup risk from §6); §2.4 sign-in step → Task 7 (incl. vanished-factor fall-through); §2.5 helpers → Task 1; §2.6 mapAuthError → Task 2; §3 i18n → Task 3; §4 testing/e2e/config → Tasks 1–2 + 8. Covered.
- **Type consistency:** `AalLevels`/`TotpFactorLike`/`shouldChallengeMfa`/`pickTotpFactor` (Task 1) used in Tasks 5/7 with matching signatures (`aal ?? null`, `factors ?? null` align with the `| null` params). i18n keys in Tasks 5/7 match Task 3 exactly (`security.*`, `mfa.*`, `errors.mfaCodeInvalid`). `AccountShell active` (Task 4) matches usage in Task 6 (`active="security"`) and `/account` (`active="profile"`).
- **Placeholder scan:** none; the only implementer-discretion notes (Button variants, tAuth namespace fix in Task 5) specify the exact required behavior.
