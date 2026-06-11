# Customer FE — Google OAuth (C3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the inert C1 `GoogleButton` into a live `signInWithOAuth({ provider: "google" })` flow through the existing `/auth/callback`, preserving locale + `returnTo`, with a dedicated `?error=oauth` flag — and fix the C1 gap where sign-in never displayed callback error flags.

**Architecture:** Client-side supabase-js OAuth from the button; the existing non-localized callback route gains a provider-error branch and locale-aware error bounces. All branching logic lives in three pure, TDD'd helpers (`buildOAuthRedirect`, `pathLocale`, `mapCallbackError`); the button/route/form just call them. External Google/Supabase config is staged AFTER code (stage-2 verification).

**Tech Stack:** Next.js 16 App Router, `@supabase/ssr` browser client (`signInWithOAuth`), next-intl (EN/VI), Vitest. No new dependencies.

**Conventions (read before coding):**
- Modified Next.js — per `apps/web/AGENTS.md`, consult `node_modules/next/dist/docs/` for unfamiliar App Router APIs.
- Run web tests from repo root: `pnpm --filter @tourism/web test`; typecheck `pnpm --filter @tourism/web typecheck`; lint `pnpm --filter @tourism/web lint`.
- Theme tokens only (no hex); no `console.log` (`console.error` in the callback route is pre-existing and allowed).
- Spec: `docs/superpowers/specs/2026-06-11-customer-fe-google-oauth-design.md`.

**File structure (all under `apps/web/src/` unless noted):**
- `features/auth/oauth.ts` (+ `oauth.test.ts`) — NEW: `buildOAuthRedirect`.
- `features/auth/redirect.ts` (+ extend `redirect.test.ts`) — add `pathLocale`.
- `features/auth/auth-error.ts` (+ extend `auth-error.test.ts`) — add `mapCallbackError`.
- `features/auth/google-button.tsx` — rewrite (live OAuth).
- `features/auth/sign-in-form.tsx` — seed callback error.
- `app/auth/callback/route.ts` — provider-error branch + locale-aware bounces.
- `app/[locale]/(auth)/sign-in/page.tsx`, `sign-up/page.tsx` — `<GoogleButton />` (no props).
- `messages/en.json`, `messages/vi.json` — add `errors.oauthFailed`, `googleRedirecting`; remove `googleSoon`.
- `docs/planning/roadmap.md` — mark C3 (final task).

---

## Task 1: `buildOAuthRedirect` (new `oauth.ts`)

**Files:**
- Create: `apps/web/src/features/auth/oauth.ts`
- Test: `apps/web/src/features/auth/oauth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/features/auth/oauth.test.ts
import { describe, it, expect } from "vitest";
import { buildOAuthRedirect } from "./oauth";

describe("buildOAuthRedirect", () => {
  it("builds the callback URL with locale + returnTo as an encoded next", () => {
    expect(buildOAuthRedirect("http://localhost:3001", "en", "/account")).toBe(
      "http://localhost:3001/auth/callback?next=%2Fen%2Faccount",
    );
  });
  it("collapses a root returnTo to just the locale (no trailing slash)", () => {
    expect(buildOAuthRedirect("http://localhost:3001", "vi", "/")).toBe(
      "http://localhost:3001/auth/callback?next=%2Fvi",
    );
  });
  it("encodes query/hash characters in returnTo exactly once", () => {
    expect(buildOAuthRedirect("http://localhost:3001", "en", "/tours?x=1")).toBe(
      "http://localhost:3001/auth/callback?next=%2Fen%2Ftours%3Fx%3D1",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tourism/web test -- oauth.test`
Expected: FAIL — cannot find module `./oauth`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/features/auth/oauth.ts
/**
 * Builds the Supabase OAuth `redirectTo` URL: the non-localized /auth/callback
 * with `next=/{locale}{returnTo}` so the post-exchange redirect keeps both the
 * locale and the original destination. `returnTo` MUST already be sanitized
 * (sanitizeReturnTo) by the caller; a root returnTo ("/") collapses to just
 * the locale segment.
 */
export function buildOAuthRedirect(origin: string, locale: string, returnTo: string): string {
  const next = `/${locale}${returnTo === "/" ? "" : returnTo}`;
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tourism/web test -- oauth.test`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth/oauth.ts apps/web/src/features/auth/oauth.test.ts
git commit -m "feat(web): buildOAuthRedirect helper (locale+returnTo next)"
```

---

## Task 2: `pathLocale` (extend `redirect.ts`)

**Files:**
- Modify: `apps/web/src/features/auth/redirect.ts` (append below `sanitizeReturnTo`)
- Test: `apps/web/src/features/auth/redirect.test.ts` (append a describe block)

- [ ] **Step 1: Write the failing test** — append to `redirect.test.ts`:

```ts
import { pathLocale } from "./redirect"; // merge into the existing import line

describe("pathLocale", () => {
  it("returns the leading segment when it is a known locale", () => {
    expect(pathLocale("/vi/account")).toBe("vi");
    expect(pathLocale("/en")).toBe("en");
    expect(pathLocale("/en/tours?x=1")).toBe("en");
  });
  it("returns null for unknown or absent locale segments", () => {
    expect(pathLocale("/account")).toBe(null);
    expect(pathLocale("/fr/x")).toBe(null);
    expect(pathLocale("/")).toBe(null);
    expect(pathLocale("")).toBe(null);
  });
});
```

Note: `/en/tours?x=1` — the segment is `"en"` only if the split strips the query correctly when the segment IS the last part; here segment 1 is `"en"` (query lives in segment 2), so plain `split("/")` suffices. The `/en?x=1` form would yield segment `"en?x=1"` — add a strip:

```ts
  it("ignores a query string attached to the locale segment", () => {
    expect(pathLocale("/en?x=1")).toBe("en");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tourism/web test -- redirect.test`
Expected: FAIL — `pathLocale` is not exported.

- [ ] **Step 3: Write minimal implementation** — append to `redirect.ts`:

```ts
import { routing } from "@/i18n/routing"; // top of file

type AppLocale = (typeof routing.locales)[number];

/**
 * Returns the leading path segment iff it is a known routing locale, else null.
 * Used by /auth/callback to keep error bounces on the user's locale. Only ever
 * returns values from `routing.locales`, so the result is injection-safe.
 */
export function pathLocale(path: string): AppLocale | null {
  const segment = (path.split("/")[1] ?? "").split(/[?#]/)[0];
  return (routing.locales as readonly string[]).includes(segment)
    ? (segment as AppLocale)
    : null;
}
```

If `(typeof routing.locales)[number]` does not resolve to `"en" | "vi"` (routing not `as const`), fall back to `export function pathLocale(path: string): "en" | "vi" | null` with the same body — verify against `apps/web/src/i18n/routing.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tourism/web test -- redirect.test`
Expected: PASS (existing `sanitizeReturnTo` cases + new `pathLocale` cases).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth/redirect.ts apps/web/src/features/auth/redirect.test.ts
git commit -m "feat(web): pathLocale helper for locale-aware callback bounces"
```

---

## Task 3: `mapCallbackError` (extend `auth-error.ts`)

**Files:**
- Modify: `apps/web/src/features/auth/auth-error.ts` (append below `mapAuthError`)
- Test: `apps/web/src/features/auth/auth-error.test.ts` (append a describe block)

- [ ] **Step 1: Write the failing test** — append to `auth-error.test.ts`:

```ts
import { mapCallbackError } from "./auth-error"; // merge into the existing import line

describe("mapCallbackError", () => {
  it("maps known callback flags to i18n keys", () => {
    expect(mapCallbackError("link")).toBe("errors.linkInvalid");
    expect(mapCallbackError("oauth")).toBe("errors.oauthFailed");
  });
  it("returns null for unknown or absent flags", () => {
    expect(mapCallbackError("weird")).toBe(null);
    expect(mapCallbackError("")).toBe(null);
    expect(mapCallbackError(null)).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tourism/web test -- auth-error.test`
Expected: FAIL — `mapCallbackError` is not exported.

- [ ] **Step 3: Write minimal implementation** — append to `auth-error.ts`:

```ts
/**
 * Maps the /auth/callback `?error=` flag (carried onto the sign-in URL) to a
 * STABLE KEY under the `Auth` i18n namespace. Unknown/absent flags → null
 * (sign-in renders nothing).
 */
export function mapCallbackError(flag: string | null): string | null {
  if (flag === "link") return "errors.linkInvalid";
  if (flag === "oauth") return "errors.oauthFailed";
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tourism/web test -- auth-error.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth/auth-error.ts apps/web/src/features/auth/auth-error.test.ts
git commit -m "feat(web): mapCallbackError flag→i18n-key helper"
```

---

## Task 4: i18n keys (`Auth` namespace, EN/VI — add only)

`googleSoon` is REMOVED in Task 5 (when its last reference dies), not here.

**Files:**
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/vi.json`

- [ ] **Step 1: Add keys to `en.json`** — inside `"Auth"`: next to `"googleCta"` add

```json
"googleRedirecting": "Redirecting to Google…",
```

and inside `"Auth"."errors"` add

```json
"oauthFailed": "Google sign-in failed. Please try again.",
```

- [ ] **Step 2: Add keys to `vi.json`** — same positions:

```json
"googleRedirecting": "Đang chuyển hướng tới Google…",
```

```json
"oauthFailed": "Đăng nhập Google thất bại. Vui lòng thử lại.",
```

- [ ] **Step 3: Verify JSON validity + parity**

```bash
node -e "for (const l of ['en','vi']) { const j=require('./apps/web/messages/'+l+'.json'); if(!j.Auth.googleRedirecting||!j.Auth.errors.oauthFailed) throw new Error(l); } console.log('ok')"
```

Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/en.json apps/web/messages/vi.json
git commit -m "feat(web): Auth i18n keys for Google OAuth (EN/VI)"
```

---

## Task 5: GoogleButton rewrite + pages + remove `googleSoon`

**Files:**
- Modify: `apps/web/src/features/auth/google-button.tsx` (full rewrite)
- Modify: `apps/web/src/app/[locale]/(auth)/sign-in/page.tsx` (the `<GoogleButton …/>` line)
- Modify: `apps/web/src/app/[locale]/(auth)/sign-up/page.tsx` (the `<GoogleButton …/>` line)
- Modify: `apps/web/messages/en.json`, `apps/web/messages/vi.json` (delete `googleSoon`)

- [ ] **Step 1: Rewrite `google-button.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@tourism/ui/components/legacy/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sanitizeReturnTo } from "./redirect";
import { buildOAuthRedirect } from "./oauth";

/**
 * Live "Continue with Google" — starts the Supabase OAuth flow. On success the
 * browser navigates away to Google, so the pending state persists until unload.
 * A returned error (e.g. provider not enabled) re-enables the button with an
 * inline alert.
 */
export function GoogleButton() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const sp = useSearchParams();
  const returnTo = sanitizeReturnTo(sp.get("returnTo"));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: buildOAuthRedirect(window.location.origin, locale, returnTo) },
    });
    if (oauthError) {
      setPending(false);
      setError(t("errors.oauthFailed"));
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={onClick}
      >
        {pending ? t("googleRedirecting") : t("googleCta")}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Update both pages** — in `sign-in/page.tsx` replace

```tsx
<GoogleButton label={t("googleCta")} soon={t("googleSoon")} />
```

with

```tsx
<GoogleButton />
```

Same replacement in `sign-up/page.tsx`. The `GoogleButton` import stays; `t` keeps its other usages.

- [ ] **Step 3: Delete `googleSoon`** from `apps/web/messages/en.json` and `vi.json` (the key inside `"Auth"`). Verify no remaining references:

```bash
grep -rn "googleSoon" apps/web/src apps/web/messages || echo "clean"
```

Expected: `clean`.

- [ ] **Step 4: Typecheck + lint + full tests**

Run: `pnpm --filter @tourism/web typecheck && pnpm --filter @tourism/web lint && pnpm --filter @tourism/web test`
Expected: all pass; the rewritten file adds zero lint issues.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth/google-button.tsx "apps/web/src/app/[locale]/(auth)/sign-in/page.tsx" "apps/web/src/app/[locale]/(auth)/sign-up/page.tsx" apps/web/messages/en.json apps/web/messages/vi.json
git commit -m "feat(web): live Google OAuth button (signInWithOAuth + pending/error states)"
```

---

## Task 6: Callback route — provider-error branch + locale-aware bounces

**Files:**
- Modify: `apps/web/src/app/auth/callback/route.ts`

- [ ] **Step 1: Extend the route.** Full new content (current file is 29 lines; this preserves the success path verbatim and adds the error branch + locale prefix):

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncUser } from "@/features/auth/actions";
import { sanitizeReturnTo, pathLocale } from "@/features/auth/redirect";

/**
 * Exchanges the `?code` from a Supabase email-verify / recovery / OAuth link
 * for a session, mirrors the user (best-effort), then redirects to the
 * sanitized `next` path. Non-localized so next-intl cannot prefix it.
 * Error bounces reuse the locale carried inside `next` (when present) so a
 * VI user is not dumped onto the EN sign-in.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeReturnTo(url.searchParams.get("next"));
  const locale = pathLocale(next);
  const prefix = locale ? `/${locale}` : "";

  // Provider errors / user cancel arrive as ?error=... (no code) from the
  // OAuth flow — bounce to sign-in with the dedicated oauth flag.
  if (url.searchParams.get("error")) {
    return NextResponse.redirect(new URL(`${prefix}/sign-in?error=oauth`, url.origin));
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const sync = await syncUser();
      if (!sync.ok) {
        console.error("[auth/callback] syncUser failed:", sync.error);
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  // No code or exchange failed → bounce to sign-in with an error flag.
  return NextResponse.redirect(new URL(`${prefix}/sign-in?error=link`, url.origin));
}
```

- [ ] **Step 2: Typecheck + full tests**

Run: `pnpm --filter @tourism/web typecheck && pnpm --filter @tourism/web test`
Expected: pass (route has no unit test; helpers it calls are tested).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/auth/callback/route.ts
git commit -m "feat(web): callback handles provider errors + locale-aware bounces"
```

---

## Task 7: Sign-in displays callback error flags

**Files:**
- Modify: `apps/web/src/features/auth/sign-in-form.tsx`

- [ ] **Step 1: Seed `formError` from the `?error=` flag.** In `sign-in-form.tsx`:

Add to the imports from `./auth-error`:

```ts
import { mapAuthError, mapCallbackError } from "./auth-error";
```

(currently `import { mapAuthError } from "./auth-error";`)

Replace the `formError` state initialization:

```ts
const [formError, setFormError] = useState<string | null>(null);
```

with:

```ts
const callbackErrorKey = mapCallbackError(sp.get("error"));
const [formError, setFormError] = useState<string | null>(
  callbackErrorKey ? t(callbackErrorKey) : null,
);
```

(`sp` and `t` are already defined above the state in the current file — keep this initialization AFTER both. The seed renders on arrival; the existing `setFormError(null)` at the top of `onSubmit` clears it on the next attempt — exactly the spec behavior.)

- [ ] **Step 2: Typecheck + lint + full tests**

Run: `pnpm --filter @tourism/web typecheck && pnpm --filter @tourism/web lint && pnpm --filter @tourism/web test`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/auth/sign-in-form.tsx
git commit -m "fix(web): sign-in renders /auth/callback error flags (link/oauth)"
```

---

## Task 8: Stage-1 verification (pre-config) + build

**Files:** none (verification only)

- [ ] **Step 1: Production build**

```bash
rm -rf apps/web/.next && pnpm --filter @tourism/web build
```

Expected: build succeeds; route table unchanged plus existing routes.

- [ ] **Step 2: Start servers** (backend 3000, web 3001; kill stale PIDs on EADDRINUSE):

```bash
pnpm --filter @tourism/api start:dev   # terminal 1
pnpm --filter @tourism/web dev         # terminal 2
```

- [ ] **Step 3: Browser checks (EN + VI), console clean:**
- `/en/sign-in` and `/vi/sign-in`: Google button ENABLED with `googleCta` label (no "coming soon" tooltip).
- Click the button → inline `errors.oauthFailed` alert appears (provider not enabled yet — expected), button re-enables. No uncaught console errors (a failed network/4xx from Supabase is acceptable IN the network tab; the page must handle it gracefully).
- `/en/sign-in?error=oauth` and `/vi/sign-in?error=oauth` → render the localized oauthFailed message on load.
- `/en/sign-in?error=link` → renders the linkInvalid message (C1 gap now fixed).
- Regression sanity: password sign-in still works (customer@example.com / `userPassword` from `.tmp/postman.env.json`); sign-up page renders with the enabled Google button.

- [ ] **Step 4: STOP — report stage-1 results to Yuri.** Config (Google Cloud + Supabase Dashboard, spec §6) is user-guided; do not proceed to stage-2 or merge without it.

---

## Task 9: Config guidance + stage-2 e2e + roadmap + merge gate

**Files:**
- Modify: `docs/planning/roadmap.md`

- [ ] **Step 1: Guide Yuri through config** (spec §6): Google Cloud OAuth client (redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`) → Supabase Dashboard enable Google provider + paste credentials → URL allow-list `http://localhost:3001/auth/callback`.

- [ ] **Step 2: Stage-2 e2e verification:**
- `/vi/account` signed-out → redirected to `/vi/sign-in?returnTo=%2Faccount` → Google → consent → back on `/vi/account`, signed in, profile loads (locale + returnTo preserved).
- Same from `/en/sign-in` plain → lands on `/en`.
- Consent-screen cancel → `/{locale}/sign-in?error=oauth` with the localized message.
- Brand-new Google account → user mirrored (role CUSTOMER), `/account` works.
- Existing-email user signs in with Google → same account (auto-link), no duplicate.
- Console clean throughout.

- [ ] **Step 3: Mark C3 done in roadmap.** Replace the `Customer FE — C3. Google OAuth` row (currently `⬜ Not started`) with a ✅ row in the C1/C2 style, linking `specs/2026-06-11-customer-fe-google-oauth-design.md` + `plans/2026-06-11-customer-fe-google-oauth.md`.

```bash
git add docs/planning/roadmap.md
git commit -m "docs: mark C3 Google OAuth done"
```

- [ ] **Step 4: Final whole-branch review, then STOP** — present results and CONFIRM with Yuri before rebase-and-merge to master, push, and branch deletion (per the feature-branch workflow).

---

## Self-Review notes (author)

- **Spec coverage:** §2.1 button → Task 5; §2.2 helpers → Tasks 1–3; §2.3 callback → Task 6; §2.4 sign-in display → Task 7; §3 i18n → Tasks 4–5 (add then remove `googleSoon` when its last reference dies); §4 stage-1/stage-2 → Tasks 8–9; §6 runbook → Task 9 Step 1. All covered.
- **Type consistency:** `buildOAuthRedirect(origin, locale, returnTo)` (Task 1) used in Task 5; `pathLocale` (Task 2) used in Task 6 via the shared `./redirect` import; `mapCallbackError` (Task 3) used in Task 7; i18n keys `googleRedirecting`/`errors.oauthFailed` (Task 4) referenced in Tasks 5–7 and asserted in Task 8.
- **Placeholder scan:** none — full code shown for every change; the only conditional is the `AppLocale` fallback in Task 2, which specifies the exact alternative signature.
