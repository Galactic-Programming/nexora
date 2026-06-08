# Customer FE — C1 Core Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the email/password authentication loop (sign-up + verify, sign-in, forgot/reset, sign-out) on Supabase for `apps/web`, mirroring each Supabase user into the local DB via `POST /auth/sync`, using the `shadcn-studio` auth blocks as the visual foundation.

**Architecture:** Client form components (react-hook-form + zod + `@supabase/supabase-js` browser client) adapted from the `shadcn-studio/blocks` auth family; one non-localized `/auth/callback` route handler (`exchangeCodeForSession` → sync → sanitized redirect) shared by email-verify/recovery (and Google in C3); one `syncUser` server action calling the backend with the access token. `returnTo` is sanitized to same-origin relative paths. The backend is unchanged.

**Tech Stack:** Next.js 16 App Router (RSC + route handlers), next-intl (EN/VI), `@supabase/ssr` + `@supabase/supabase-js`, react-hook-form 7.77 + zod 4.4 + `@hookform/resolvers`, `@tourism/ui` (legacy `Field`/`Input`/`InputGroup`/`Button`/`Card` + custom `dropdown-menu`/`avatar`), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-08-customer-fe-auth-core-design.md`

**Conventions:** Repo root `c:\develop\Apps\Main-Projects\tourism-be-api`. Branch `feat/customer-fe-auth-core` (already checked out). Windows + PowerShell; absolute paths; do not `cd`. App cmd prefix `pnpm --filter @tourism/web`. `@/` → `apps/web/src`. Cost-monitor hook is DISABLED — ignore any cost warnings and finish each task. Every subagent must verify reused component/prop names against the real files and adapt rather than guess.

---

## File Structure

```text
apps/web/
  package.json                                    # + @hookform/resolvers
  src/
    features/auth/
      schemas.ts (+ schemas.test.ts)              # zod: signIn/signUp/forgot/reset; message KEYS
      redirect.ts (+ redirect.test.ts)            # sanitizeReturnTo(): same-origin relative only
      auth-error.ts (+ auth-error.test.ts)        # Supabase AuthError -> Auth i18n key
      actions.ts (+ actions.test.ts)              # 'use server': syncUser(), signOutAction()
      auth-card.tsx                               # shared shell: AuthBackgroundShape + Card + title/desc + children
      google-button.tsx                           # inert "continue with Google" SEAM for C3
      check-email-notice.tsx                      # shared "we sent a link" panel
      sign-in-form.tsx                            # client form
      sign-up-form.tsx                            # client form (+ confirm pw, check-email branch)
      forgot-password-form.tsx                    # client form (+ check-email branch)
      reset-password-form.tsx                     # client form (updateUser password)
    app/
      [locale]/(auth)/layout.tsx                  # centered wrapper + redirect signed-in users away
      [locale]/(auth)/sign-in/page.tsx
      [locale]/(auth)/sign-up/page.tsx
      [locale]/(auth)/forgot-password/page.tsx
      [locale]/(auth)/reset-password/page.tsx
      auth/callback/route.ts                      # NON-localized: code exchange -> sync -> redirect
    components/layout/user-menu.tsx               # MODIFY: dropdown (email/avatar -> Account + Sign out)
    proxy.ts                                      # MODIFY: bypass i18n for /auth/* paths
    messages/en.json, messages/vi.json            # MODIFY: Auth namespace + Nav additions
```

---

## Task 1: Dependency + zod schemas

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/features/auth/schemas.ts`
- Test: `apps/web/src/features/auth/schemas.test.ts`

- [ ] **Step 1: Add the resolver dependency**

Run: `pnpm --filter @tourism/web add @hookform/resolvers`
Expected: `@hookform/resolvers` appears in `apps/web/package.json` dependencies; lockfile updated.

- [ ] **Step 2: Write the failing test** `apps/web/src/features/auth/schemas.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { signInSchema, signUpSchema, forgotSchema, resetSchema } from "./schemas";

describe("signInSchema", () => {
  it("accepts a valid email + password", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "secret12" }).success).toBe(true);
  });
  it("rejects an invalid email", () => {
    const r = signInSchema.safeParse({ email: "nope", password: "secret12" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("validation.emailInvalid");
  });
  it("rejects a short password", () => {
    const r = signInSchema.safeParse({ email: "a@b.com", password: "x" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("validation.passwordMin");
  });
});

describe("signUpSchema", () => {
  it("accepts matching passwords", () => {
    expect(signUpSchema.safeParse({ email: "a@b.com", password: "secret12", confirmPassword: "secret12" }).success).toBe(true);
  });
  it("rejects mismatched confirmPassword on the confirm field", () => {
    const r = signUpSchema.safeParse({ email: "a@b.com", password: "secret12", confirmPassword: "nope1234" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path[0] === "confirmPassword");
      expect(issue?.message).toBe("validation.passwordMismatch");
    }
  });
});

describe("forgotSchema / resetSchema", () => {
  it("forgot accepts an email", () => {
    expect(forgotSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });
  it("reset requires matching passwords", () => {
    expect(resetSchema.safeParse({ password: "secret12", confirmPassword: "secret12" }).success).toBe(true);
    expect(resetSchema.safeParse({ password: "secret12", confirmPassword: "x" }).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @tourism/web test src/features/auth/schemas.test.ts`
Expected: FAIL ("Failed to resolve import ./schemas").

- [ ] **Step 4: Implement** `apps/web/src/features/auth/schemas.ts`

```ts
import { z } from "zod";

// Validation messages are STABLE KEYS under the `Auth` i18n namespace; the
// forms render them via `t(key)`. Keep keys in sync with messages/*.json.
const email = z.string().email("validation.emailInvalid");
const password = z.string().min(8, "validation.passwordMin").max(72, "validation.passwordMax");

export const signInSchema = z.object({ email, password });
export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({ email, password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "validation.passwordMismatch",
    path: ["confirmPassword"],
  });
export type SignUpValues = z.infer<typeof signUpSchema>;

export const forgotSchema = z.object({ email });
export type ForgotValues = z.infer<typeof forgotSchema>;

export const resetSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "validation.passwordMismatch",
    path: ["confirmPassword"],
  });
export type ResetValues = z.infer<typeof resetSchema>;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @tourism/web test src/features/auth/schemas.test.ts`
Expected: PASS (all). Then `pnpm --filter @tourism/web typecheck` clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/src/features/auth/schemas.ts apps/web/src/features/auth/schemas.test.ts
git commit -m "feat(web): auth zod schemas + @hookform/resolvers dep"
```
(If the lockfile lives at repo root, stage the root `pnpm-lock.yaml` instead — run `git status` first and stage whatever changed.)

---

## Task 2: returnTo sanitizer + auth-error mapper

**Files:**
- Create: `apps/web/src/features/auth/redirect.ts`, `apps/web/src/features/auth/auth-error.ts`
- Test: `apps/web/src/features/auth/redirect.test.ts`, `apps/web/src/features/auth/auth-error.test.ts`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/features/auth/redirect.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { sanitizeReturnTo } from "./redirect";

describe("sanitizeReturnTo", () => {
  it("allows a same-origin relative path", () => {
    expect(sanitizeReturnTo("/tours")).toBe("/tours");
    expect(sanitizeReturnTo("/tours?x=1#a")).toBe("/tours?x=1#a");
  });
  it("falls back to / for missing or non-relative values", () => {
    expect(sanitizeReturnTo(null)).toBe("/");
    expect(sanitizeReturnTo("")).toBe("/");
    expect(sanitizeReturnTo("tours")).toBe("/");          // not absolute
    expect(sanitizeReturnTo("//evil.com")).toBe("/");      // protocol-relative
    expect(sanitizeReturnTo("https://evil.com")).toBe("/");
    expect(sanitizeReturnTo("/\\evil")).toBe("/");          // backslash trick
  });
});
```

`apps/web/src/features/auth/auth-error.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mapAuthError } from "./auth-error";

describe("mapAuthError", () => {
  it("maps invalid credentials", () => {
    expect(mapAuthError({ message: "Invalid login credentials" })).toBe("errors.invalidCredentials");
  });
  it("maps unconfirmed email", () => {
    expect(mapAuthError({ message: "Email not confirmed" })).toBe("errors.emailNotConfirmed");
  });
  it("maps already-registered", () => {
    expect(mapAuthError({ message: "User already registered" })).toBe("errors.emailTaken");
  });
  it("maps rate limiting", () => {
    expect(mapAuthError({ message: "For security purposes, you can only request this after 30 seconds" })).toBe("errors.rateLimited");
  });
  it("falls back to a generic key", () => {
    expect(mapAuthError({ message: "some unknown thing" })).toBe("errors.generic");
    expect(mapAuthError(null)).toBe("errors.generic");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tourism/web test src/features/auth/redirect.test.ts src/features/auth/auth-error.test.ts`
Expected: FAIL (imports unresolved).

- [ ] **Step 3: Implement** `apps/web/src/features/auth/redirect.ts`

```ts
/**
 * Returns a safe redirect target: only same-origin RELATIVE paths are allowed.
 * Anything else (absolute URL, protocol-relative `//`, backslash tricks, empty)
 * falls back to "/". Prevents open-redirect via `?returnTo=` / callback `next`.
 */
export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value) return "/";
  // Must start with a single "/" and not "//" or "/\" (browser-normalised host).
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
```

- [ ] **Step 4: Implement** `apps/web/src/features/auth/auth-error.ts`

```ts
/** Minimal shape we read off a Supabase AuthError (avoids a hard dep import). */
interface AuthErrorLike {
  message?: string;
}

/**
 * Maps a Supabase auth error to a STABLE KEY under the `Auth` i18n namespace.
 * Matching is substring-based on the English message (Supabase doesn't expose
 * stable codes for these). Unknown errors fall back to `errors.generic`.
 */
export function mapAuthError(error: AuthErrorLike | null | undefined): string {
  const msg = error?.message?.toLowerCase() ?? "";
  if (msg.includes("invalid login credentials")) return "errors.invalidCredentials";
  if (msg.includes("email not confirmed")) return "errors.emailNotConfirmed";
  if (msg.includes("already registered")) return "errors.emailTaken";
  if (msg.includes("for security purposes") || msg.includes("rate limit")) return "errors.rateLimited";
  if (msg.includes("expired") || msg.includes("invalid")) return "errors.linkInvalid";
  return "errors.generic";
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @tourism/web test src/features/auth/redirect.test.ts src/features/auth/auth-error.test.ts`
Expected: PASS. Then `pnpm --filter @tourism/web typecheck` clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/auth/redirect.ts apps/web/src/features/auth/redirect.test.ts apps/web/src/features/auth/auth-error.ts apps/web/src/features/auth/auth-error.test.ts
git commit -m "feat(web): returnTo sanitizer + supabase auth-error mapper"
```

---

## Task 3: Server actions (syncUser, signOut)

**Files:**
- Create: `apps/web/src/features/auth/actions.ts`
- Test: `apps/web/src/features/auth/actions.test.ts`

Context: `createApiClient(token)` (`@/lib/api/client`) is openapi-fetch with an envelope middleware that THROWS `ApiError` on an error envelope — so wrap the call in try/catch. The sync path key is `/api/v1/auth/sync` (POST, optional `SyncUserDto` body → `{}` is valid). The server supabase client (`@/lib/supabase/server`) reads the session cookie.

- [ ] **Step 1: Write the failing test** `apps/web/src/features/auth/actions.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getSession = vi.fn();
const signOut = vi.fn();
const POST = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getSession, signOut } }),
}));
vi.mock("@/lib/api/client", () => ({
  createApiClient: (token?: string) => {
    POST.mock.calls.push.__token = token; // record token via closure below instead
    return { POST };
  },
}));

import { syncUser, signOutAction } from "./actions";

beforeEach(() => {
  getSession.mockReset();
  signOut.mockReset();
  POST.mockReset();
});

describe("syncUser", () => {
  it("returns ok:false when there is no session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await syncUser()).toEqual({ ok: false, error: "NO_SESSION" });
    expect(POST).not.toHaveBeenCalled();
  });
  it("POSTs /api/v1/auth/sync and returns ok:true on success", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    POST.mockResolvedValue({ data: {}, error: undefined });
    expect(await syncUser()).toEqual({ ok: true });
    expect(POST).toHaveBeenCalledWith("/api/v1/auth/sync", { body: {} });
  });
  it("returns ok:false when the API throws", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    POST.mockRejectedValue(new Error("boom"));
    expect(await syncUser()).toEqual({ ok: false, error: "SYNC_FAILED" });
  });
});

describe("signOutAction", () => {
  it("calls supabase signOut", async () => {
    signOut.mockResolvedValue({ error: null });
    await signOutAction();
    expect(signOut).toHaveBeenCalled();
  });
});
```

Note: the token-capture line above is awkward; in Step 3 the implementer should instead assert the token by having `createApiClient` mock record it in a module-scoped variable. Replace the `vi.mock("@/lib/api/client", ...)` block with:
```ts
let lastToken: string | undefined;
vi.mock("@/lib/api/client", () => ({
  createApiClient: (token?: string) => { lastToken = token; return { POST }; },
}));
```
and add inside the success test: `expect(lastToken).toBe("tok");`. (Hoisting: declare `let lastToken` with `var`-like access via `vi.hoisted` if needed — use `const { POST, getSession, signOut } = vi.hoisted(() => ({ ... }))` pattern if the simple form complains.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tourism/web test src/features/auth/actions.test.ts`
Expected: FAIL (import unresolved).

- [ ] **Step 3: Implement** `apps/web/src/features/auth/actions.ts`

```ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createApiClient } from "@/lib/api/client";

export type SyncResult = { ok: true } | { ok: false; error: "NO_SESSION" | "SYNC_FAILED" };

/**
 * Mirrors the signed-in Supabase user into the local DB via POST /auth/sync,
 * using the server-side access token. Best-effort: callers surface the error
 * and may retry, but a failure does NOT invalidate the Supabase session.
 */
export async function syncUser(): Promise<SyncResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "NO_SESSION" };

  try {
    const api = createApiClient(session.access_token);
    await api.POST("/api/v1/auth/sync", { body: {} });
    return { ok: true };
  } catch {
    return { ok: false, error: "SYNC_FAILED" };
  }
}

/** Signs the user out (clears the Supabase session cookie). */
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tourism/web test src/features/auth/actions.test.ts`
Expected: PASS. Then `pnpm --filter @tourism/web typecheck` clean. (If the `POST` typing complains about the literal path, confirm the path key exists in `schema.d.ts` as `/api/v1/auth/sync`.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth/actions.ts apps/web/src/features/auth/actions.test.ts
git commit -m "feat(web): syncUser + signOut server actions"
```

---

## Task 4: i18n — Auth namespace + Nav additions

**Files:**
- Modify: `apps/web/messages/en.json`, `apps/web/messages/vi.json`

Read both files first; MERGE a new `Auth` namespace (do not clobber existing namespaces) and add two keys to the existing `Nav`.

- [ ] **Step 1: Add `Auth` to `apps/web/messages/en.json`**

```json
"Auth": {
  "signInTitle": "Sign in",
  "signInSubtitle": "Welcome back. Sign in to continue.",
  "signUpTitle": "Create your account",
  "signUpSubtitle": "Join to book and manage your tours.",
  "forgotTitle": "Reset your password",
  "forgotSubtitle": "Enter your email and we'll send you a reset link.",
  "resetTitle": "Set a new password",
  "resetSubtitle": "Choose a new password for your account.",
  "emailLabel": "Email address",
  "emailPlaceholder": "you@example.com",
  "passwordLabel": "Password",
  "confirmPasswordLabel": "Confirm password",
  "passwordPlaceholder": "••••••••",
  "showPassword": "Show password",
  "hidePassword": "Hide password",
  "signInCta": "Sign in",
  "signUpCta": "Create account",
  "forgotCta": "Send reset link",
  "resetCta": "Update password",
  "googleCta": "Continue with Google",
  "googleSoon": "Google sign-in is coming soon",
  "orDivider": "or",
  "noAccount": "New here?",
  "createAccount": "Create an account",
  "haveAccount": "Already have an account?",
  "backToSignIn": "Back to sign in",
  "forgotLink": "Forgot password?",
  "checkEmailTitle": "Check your email",
  "checkEmailBody": "We sent a link to {email}. Click it to continue.",
  "signOut": "Sign out",
  "validation": {
    "emailInvalid": "Enter a valid email address.",
    "passwordMin": "Password must be at least 8 characters.",
    "passwordMax": "Password is too long.",
    "passwordMismatch": "Passwords do not match."
  },
  "errors": {
    "invalidCredentials": "Wrong email or password.",
    "emailNotConfirmed": "Please confirm your email first. Check your inbox.",
    "emailTaken": "An account with this email already exists.",
    "rateLimited": "Too many attempts. Please wait a moment and try again.",
    "linkInvalid": "This link is invalid or has expired. Request a new one.",
    "syncFailed": "Signed in, but we couldn't load your profile. Retry.",
    "generic": "Something went wrong. Please try again."
  }
}
```

- [ ] **Step 2: Add the same `Auth` namespace to `apps/web/messages/vi.json`** (Vietnamese)

```json
"Auth": {
  "signInTitle": "Đăng nhập",
  "signInSubtitle": "Chào mừng trở lại. Đăng nhập để tiếp tục.",
  "signUpTitle": "Tạo tài khoản",
  "signUpSubtitle": "Tham gia để đặt và quản lý tour của bạn.",
  "forgotTitle": "Đặt lại mật khẩu",
  "forgotSubtitle": "Nhập email, chúng tôi sẽ gửi liên kết đặt lại.",
  "resetTitle": "Đặt mật khẩu mới",
  "resetSubtitle": "Chọn mật khẩu mới cho tài khoản của bạn.",
  "emailLabel": "Địa chỉ email",
  "emailPlaceholder": "ban@example.com",
  "passwordLabel": "Mật khẩu",
  "confirmPasswordLabel": "Xác nhận mật khẩu",
  "passwordPlaceholder": "••••••••",
  "showPassword": "Hiện mật khẩu",
  "hidePassword": "Ẩn mật khẩu",
  "signInCta": "Đăng nhập",
  "signUpCta": "Tạo tài khoản",
  "forgotCta": "Gửi liên kết",
  "resetCta": "Cập nhật mật khẩu",
  "googleCta": "Tiếp tục với Google",
  "googleSoon": "Đăng nhập Google sẽ sớm có",
  "orDivider": "hoặc",
  "noAccount": "Bạn mới biết đến?",
  "createAccount": "Tạo tài khoản",
  "haveAccount": "Đã có tài khoản?",
  "backToSignIn": "Quay lại đăng nhập",
  "forgotLink": "Quên mật khẩu?",
  "checkEmailTitle": "Kiểm tra email",
  "checkEmailBody": "Chúng tôi đã gửi liên kết tới {email}. Nhấp vào để tiếp tục.",
  "signOut": "Đăng xuất",
  "validation": {
    "emailInvalid": "Nhập địa chỉ email hợp lệ.",
    "passwordMin": "Mật khẩu cần ít nhất 8 ký tự.",
    "passwordMax": "Mật khẩu quá dài.",
    "passwordMismatch": "Mật khẩu không khớp."
  },
  "errors": {
    "invalidCredentials": "Sai email hoặc mật khẩu.",
    "emailNotConfirmed": "Vui lòng xác nhận email trước. Kiểm tra hộp thư.",
    "emailTaken": "Đã tồn tại tài khoản với email này.",
    "rateLimited": "Quá nhiều lần thử. Vui lòng đợi một lát rồi thử lại.",
    "linkInvalid": "Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.",
    "syncFailed": "Đã đăng nhập, nhưng chưa tải được hồ sơ. Thử lại.",
    "generic": "Đã có lỗi xảy ra. Vui lòng thử lại."
  }
}
```

- [ ] **Step 3: Add `account` + `signOut` to the existing `Nav` namespace in BOTH files**

`en.json` `Nav`: add `"account": "Account"` and `"signOut": "Sign out"`.
`vi.json` `Nav`: add `"account": "Tài khoản"` and `"signOut": "Đăng xuất"`.

- [ ] **Step 4: Verify valid JSON + namespaces intact**

Run:
```bash
node -e "const e=require('./apps/web/messages/en.json'),v=require('./apps/web/messages/vi.json'); console.log('en.Auth keys', Object.keys(e.Auth).length, 'vi.Auth keys', Object.keys(v.Auth).length, 'Nav.account', e.Nav.account, v.Nav.account, 'HomePage intact', !!e.HomePage||!!e.Home, 'Destinations intact', !!e.Destinations)"
```
Expected: prints key counts (both equal), `Nav.account` values, and `true` for the intact spot-checks.

- [ ] **Step 5: Commit**

```bash
git add apps/web/messages/en.json apps/web/messages/vi.json
git commit -m "feat(web): Auth i18n namespace (EN/VI) + Nav account/signOut"
```

---

## Task 5: callback route + proxy bypass + (auth) layout + shared shell

**Files:**
- Create: `apps/web/src/app/auth/callback/route.ts`
- Modify: `apps/web/src/proxy.ts`
- Create: `apps/web/src/app/[locale]/(auth)/layout.tsx`
- Create: `apps/web/src/features/auth/auth-card.tsx`, `apps/web/src/features/auth/google-button.tsx`

Context: `proxy.ts` composes next-intl (`localePrefix: 'always'`) + `updateSupabaseSession`. A non-localized `/auth/callback` would be locale-prefixed and 404 — so bypass i18n for `/auth/*` while STILL refreshing the session cookie.

- [ ] **Step 1: Modify** `apps/web/src/proxy.ts` to bypass i18n for `/auth/*`

```ts
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSupabaseSession } from "./lib/supabase/middleware";

const handleI18n = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  // Non-localized auth route handler (email-verify / recovery / OAuth callback)
  // must NOT be locale-prefixed by next-intl — just refresh the session cookie.
  if (request.nextUrl.pathname.startsWith("/auth/")) {
    return updateSupabaseSession(request, NextResponse.next());
  }
  const response = handleI18n(request);
  return updateSupabaseSession(request, response);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
```

- [ ] **Step 2: Create** `apps/web/src/app/auth/callback/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncUser } from "@/features/auth/actions";
import { sanitizeReturnTo } from "@/features/auth/redirect";

/**
 * Exchanges the `?code` from a Supabase email-verify / recovery / OAuth link
 * for a session, mirrors the user (best-effort), then redirects to the
 * sanitized `next` path. Non-localized so next-intl cannot prefix it.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeReturnTo(url.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await syncUser();
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  // No code or exchange failed → bounce to sign-in with an error flag.
  return NextResponse.redirect(new URL("/sign-in?error=link", url.origin));
}
```

- [ ] **Step 3: Create the shared shell** `apps/web/src/features/auth/auth-card.tsx`

```tsx
import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tourism/ui/components/legacy/card";
import AuthBackgroundShape from "@tourism/ui/assets/svg/auth-background-shape";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Centered auth card with the shared decorative background (adapted from
 *  shadcn-studio blocks; brand-neutral, no "Shadcn Studio" copy). */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-x-hidden px-4 py-10">
      <div className="pointer-events-none absolute" aria-hidden="true">
        <AuthBackgroundShape />
      </div>
      <Card className="z-1 w-full gap-6 py-6 sm:max-w-md">
        <CardHeader className="gap-2 px-6">
          <CardTitle className="text-2xl font-semibold">{title}</CardTitle>
          <CardDescription className="text-base">{subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-6">
          {children}
          {footer}
        </CardContent>
      </Card>
    </div>
  );
}
```
(If `AuthBackgroundShape` or the legacy `Card` export names differ, confirm in `packages/ui/src/...` and adapt.)

- [ ] **Step 4: Create the Google seam** `apps/web/src/features/auth/google-button.tsx`

```tsx
"use client";

import { Button } from "@tourism/ui/components/legacy/button";

/** Inert "continue with Google" button — visual seam for C3. Disabled with a
 *  tooltip-style title; no OAuth logic until C3 wires signInWithOAuth. */
export function GoogleButton({ label, soon }: { label: string; soon: string }) {
  return (
    <Button variant="outline" className="w-full" disabled title={soon} aria-disabled="true">
      {label}
    </Button>
  );
}
```

- [ ] **Step 5: Create** `apps/web/src/app/[locale]/(auth)/layout.tsx`

```tsx
import type { ReactNode } from "react";
import { redirect } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Auth pages are for signed-OUT users. If already signed in, bounce home. */
export default async function AuthLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect({ href: "/", locale });
  return <>{children}</>;
}
```
(Confirm `redirect` from `@/i18n/navigation` takes `{ href, locale }`; if the installed next-intl signature differs, adapt — it may be `redirect("/", locale)` or `redirect({href,locale})`.)

- [ ] **Step 6: Verify**

Run: `pnpm --filter @tourism/web typecheck` → clean. `pnpm --filter @tourism/web test` → existing suite still green.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/proxy.ts "apps/web/src/app/auth/callback/route.ts" "apps/web/src/app/[locale]/(auth)/layout.tsx" apps/web/src/features/auth/auth-card.tsx apps/web/src/features/auth/google-button.tsx
git commit -m "feat(web): auth callback route, /auth proxy bypass, (auth) layout + shell"
```

---

## Task 6: Sign-in form + page

**Files:**
- Create: `apps/web/src/features/auth/sign-in-form.tsx`
- Create: `apps/web/src/app/[locale]/(auth)/sign-in/page.tsx`

Establishes the reusable form pattern: RHF + zodResolver, supabase browser client, `t(mapAuthError(...))` for the top error, field errors via `t(errors.field.message)`, a password field with an eye toggle (adapted from the block), then `syncUser()` + `router.push(returnTo)`.

- [ ] **Step 1: Create** `apps/web/src/features/auth/sign-in-form.tsx`

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@tourism/ui/components/legacy/button";
import { Field, FieldGroup, FieldLabel } from "@tourism/ui/components/legacy/field";
import { Input } from "@tourism/ui/components/legacy/input";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@tourism/ui/components/legacy/input-group";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { signInSchema, type SignInValues } from "./schemas";
import { sanitizeReturnTo } from "./redirect";
import { mapAuthError } from "./auth-error";
import { syncUser } from "./actions";

export function SignInForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const sp = useSearchParams();
  const returnTo = sanitizeReturnTo(sp.get("returnTo"));
  const [showPw, setShowPw] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  async function onSubmit(values: SignInValues) {
    setFormError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setFormError(t(mapAuthError(error)));
      return;
    }
    await syncUser();
    router.push(returnTo);
    router.refresh();
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
          <Input id="email" type="email" autoComplete="email" placeholder={t("emailPlaceholder")} {...register("email")} />
          {errors.email && <p className="text-destructive text-sm">{t(errors.email.message!)}</p>}
        </Field>
        <Field className="w-full gap-2">
          <FieldLabel htmlFor="password">{t("passwordLabel")}</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              placeholder={t("passwordPlaceholder")}
              {...register("password")}
            />
            <InputGroupAddon align="inline-end" className="pr-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPw((s) => !s)}
                className="text-muted-foreground hover:bg-transparent"
              >
                {showPw ? <EyeOffIcon /> : <EyeIcon />}
                <span className="sr-only">{showPw ? t("hidePassword") : t("showPassword")}</span>
              </Button>
            </InputGroupAddon>
          </InputGroup>
          {errors.password && <p className="text-destructive text-sm">{t(errors.password.message!)}</p>}
        </Field>
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
(Confirm legacy `Input` forwards refs / accepts `{...register}`. If `Input` doesn't forward a ref, use the legacy `InputGroupInput` for both fields or RHF `Controller`. Verify against `packages/ui/src/components/legacy/input.tsx` before finalizing.)

- [ ] **Step 2: Create** `apps/web/src/app/[locale]/(auth)/sign-in/page.tsx`

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Separator } from "@tourism/ui/components/legacy/separator";
import { AuthCard } from "@/features/auth/auth-card";
import { GoogleButton } from "@/features/auth/google-button";
import { SignInForm } from "@/features/auth/sign-in-form";

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  return (
    <AuthCard
      title={t("signInTitle")}
      subtitle={t("signInSubtitle")}
      footer={
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="hover:underline">{t("forgotLink")}</Link>
            <span>
              {t("noAccount")} <Link href="/sign-up" className="text-card-foreground hover:underline">{t("createAccount")}</Link>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-sm">{t("orDivider")}</span>
            <Separator className="flex-1" />
          </div>
          <GoogleButton label={t("googleCta")} soon={t("googleSoon")} />
        </div>
      }
    >
      <SignInForm />
    </AuthCard>
  );
}
```

- [ ] **Step 3: Verify (typecheck + lint + manual smoke)**

Run: `pnpm --filter @tourism/web typecheck` → clean. `pnpm --filter @tourism/web lint` → no new errors.
(Full browser smoke happens in Task 10; here just confirm it compiles.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/auth/sign-in-form.tsx "apps/web/src/app/[locale]/(auth)/sign-in/page.tsx"
git commit -m "feat(web): sign-in form + page"
```

---

## Task 7: Sign-up form + page + check-email notice

**Files:**
- Create: `apps/web/src/features/auth/check-email-notice.tsx`
- Create: `apps/web/src/features/auth/sign-up-form.tsx`
- Create: `apps/web/src/app/[locale]/(auth)/sign-up/page.tsx`

- [ ] **Step 1: Create** `apps/web/src/features/auth/check-email-notice.tsx`

```tsx
"use client";

import { useTranslations } from "next-intl";

/** Shared "we sent you a link" panel (sign-up + forgot). */
export function CheckEmailNotice({ email }: { email: string }) {
  const t = useTranslations("Auth");
  return (
    <div className="space-y-2 text-center" role="status">
      <h2 className="text-lg font-semibold">{t("checkEmailTitle")}</h2>
      <p className="text-muted-foreground text-sm">{t("checkEmailBody", { email })}</p>
    </div>
  );
}
```

- [ ] **Step 2: Create** `apps/web/src/features/auth/sign-up-form.tsx`

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@tourism/ui/components/legacy/button";
import { Field, FieldGroup, FieldLabel } from "@tourism/ui/components/legacy/field";
import { Input } from "@tourism/ui/components/legacy/input";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@tourism/ui/components/legacy/input-group";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { signUpSchema, type SignUpValues } from "./schemas";
import { sanitizeReturnTo } from "./redirect";
import { mapAuthError } from "./auth-error";
import { syncUser } from "./actions";
import { CheckEmailNotice } from "./check-email-notice";

export function SignUpForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const sp = useSearchParams();
  const returnTo = sanitizeReturnTo(sp.get("returnTo"));
  const [showPw, setShowPw] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) });

  async function onSubmit(values: SignUpValues) {
    setFormError(null);
    const supabase = createSupabaseBrowserClient();
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`;
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { emailRedirectTo },
    });
    if (error) {
      setFormError(t(mapAuthError(error)));
      return;
    }
    if (data.session) {
      // Confirm-email OFF → already signed in.
      await syncUser();
      router.push(returnTo);
      router.refresh();
      return;
    }
    // Confirm-email ON → show the check-email panel.
    setSentTo(values.email);
  }

  if (sentTo) return <CheckEmailNotice email={sentTo} />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        {formError && <p role="alert" className="text-destructive text-sm">{formError}</p>}
        <Field className="gap-2">
          <FieldLabel htmlFor="email">{t("emailLabel")}</FieldLabel>
          <Input id="email" type="email" autoComplete="email" placeholder={t("emailPlaceholder")} {...register("email")} />
          {errors.email && <p className="text-destructive text-sm">{t(errors.email.message!)}</p>}
        </Field>
        <Field className="w-full gap-2">
          <FieldLabel htmlFor="password">{t("passwordLabel")}</FieldLabel>
          <InputGroup>
            <InputGroupInput id="password" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder={t("passwordPlaceholder")} {...register("password")} />
            <InputGroupAddon align="inline-end" className="pr-1.5">
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowPw((s) => !s)} className="text-muted-foreground hover:bg-transparent">
                {showPw ? <EyeOffIcon /> : <EyeIcon />}
                <span className="sr-only">{showPw ? t("hidePassword") : t("showPassword")}</span>
              </Button>
            </InputGroupAddon>
          </InputGroup>
          {errors.password && <p className="text-destructive text-sm">{t(errors.password.message!)}</p>}
        </Field>
        <Field className="w-full gap-2">
          <FieldLabel htmlFor="confirmPassword">{t("confirmPasswordLabel")}</FieldLabel>
          <Input id="confirmPassword" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder={t("passwordPlaceholder")} {...register("confirmPassword")} />
          {errors.confirmPassword && <p className="text-destructive text-sm">{t(errors.confirmPassword.message!)}</p>}
        </Field>
        <Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>{t("signUpCta")}</Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
```

- [ ] **Step 3: Create** `apps/web/src/app/[locale]/(auth)/sign-up/page.tsx`

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Separator } from "@tourism/ui/components/legacy/separator";
import { AuthCard } from "@/features/auth/auth-card";
import { GoogleButton } from "@/features/auth/google-button";
import { SignUpForm } from "@/features/auth/sign-up-form";

export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  return (
    <AuthCard
      title={t("signUpTitle")}
      subtitle={t("signUpSubtitle")}
      footer={
        <div className="space-y-4">
          <p className="text-sm">
            {t("haveAccount")} <Link href="/sign-in" className="text-card-foreground hover:underline">{t("backToSignIn")}</Link>
          </p>
          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-sm">{t("orDivider")}</span>
            <Separator className="flex-1" />
          </div>
          <GoogleButton label={t("googleCta")} soon={t("googleSoon")} />
        </div>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @tourism/web typecheck` → clean; `pnpm --filter @tourism/web lint` → no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth/check-email-notice.tsx apps/web/src/features/auth/sign-up-form.tsx "apps/web/src/app/[locale]/(auth)/sign-up/page.tsx"
git commit -m "feat(web): sign-up form + page + check-email notice"
```

---

## Task 8: Forgot-password + Reset-password forms + pages

**Files:**
- Create: `apps/web/src/features/auth/forgot-password-form.tsx`, `apps/web/src/features/auth/reset-password-form.tsx`
- Create: `apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx`, `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx`

- [ ] **Step 1: Create** `apps/web/src/features/auth/forgot-password-form.tsx`

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@tourism/ui/components/legacy/button";
import { Field, FieldGroup, FieldLabel } from "@tourism/ui/components/legacy/field";
import { Input } from "@tourism/ui/components/legacy/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { forgotSchema, type ForgotValues } from "./schemas";
import { mapAuthError } from "./auth-error";
import { CheckEmailNotice } from "./check-email-notice";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) });

  async function onSubmit(values: ForgotValues) {
    setFormError(null);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, { redirectTo });
    if (error) {
      setFormError(t(mapAuthError(error)));
      return;
    }
    setSentTo(values.email);
  }

  if (sentTo) return <CheckEmailNotice email={sentTo} />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        {formError && <p role="alert" className="text-destructive text-sm">{formError}</p>}
        <Field className="gap-2">
          <FieldLabel htmlFor="email">{t("emailLabel")}</FieldLabel>
          <Input id="email" type="email" autoComplete="email" placeholder={t("emailPlaceholder")} {...register("email")} />
          {errors.email && <p className="text-destructive text-sm">{t(errors.email.message!)}</p>}
        </Field>
        <Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>{t("forgotCta")}</Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
```

- [ ] **Step 2: Create** `apps/web/src/features/auth/reset-password-form.tsx`

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@tourism/ui/components/legacy/button";
import { Field, FieldGroup, FieldLabel } from "@tourism/ui/components/legacy/field";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@tourism/ui/components/legacy/input-group";
import { Input } from "@tourism/ui/components/legacy/input";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resetSchema, type ResetValues } from "./schemas";
import { mapAuthError } from "./auth-error";

export function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) });

  async function onSubmit(values: ResetValues) {
    setFormError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setFormError(t(mapAuthError(error)));
      return;
    }
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        {formError && <p role="alert" className="text-destructive text-sm">{formError}</p>}
        <Field className="w-full gap-2">
          <FieldLabel htmlFor="password">{t("passwordLabel")}</FieldLabel>
          <InputGroup>
            <InputGroupInput id="password" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder={t("passwordPlaceholder")} {...register("password")} />
            <InputGroupAddon align="inline-end" className="pr-1.5">
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowPw((s) => !s)} className="text-muted-foreground hover:bg-transparent">
                {showPw ? <EyeOffIcon /> : <EyeIcon />}
                <span className="sr-only">{showPw ? t("hidePassword") : t("showPassword")}</span>
              </Button>
            </InputGroupAddon>
          </InputGroup>
          {errors.password && <p className="text-destructive text-sm">{t(errors.password.message!)}</p>}
        </Field>
        <Field className="w-full gap-2">
          <FieldLabel htmlFor="confirmPassword">{t("confirmPasswordLabel")}</FieldLabel>
          <Input id="confirmPassword" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder={t("passwordPlaceholder")} {...register("confirmPassword")} />
          {errors.confirmPassword && <p className="text-destructive text-sm">{t(errors.confirmPassword.message!)}</p>}
        </Field>
        <Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>{t("resetCta")}</Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
```

- [ ] **Step 3: Create the two pages**

`apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx`:
```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthCard } from "@/features/auth/auth-card";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  return (
    <AuthCard
      title={t("forgotTitle")}
      subtitle={t("forgotSubtitle")}
      footer={<p className="text-sm"><Link href="/sign-in" className="hover:underline">{t("backToSignIn")}</Link></p>}
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
```

`apps/web/src/app/[locale]/(auth)/reset-password/page.tsx`:
```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/features/auth/auth-card";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  return (
    <AuthCard title={t("resetTitle")} subtitle={t("resetSubtitle")}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @tourism/web typecheck` → clean; `pnpm --filter @tourism/web lint` → no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth/forgot-password-form.tsx apps/web/src/features/auth/reset-password-form.tsx "apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx" "apps/web/src/app/[locale]/(auth)/reset-password/page.tsx"
git commit -m "feat(web): forgot + reset password forms + pages"
```

---

## Task 9: UserMenu dropdown (signed-in state + sign out)

**Files:**
- Modify: `apps/web/src/components/layout/user-menu.tsx`
- Create: `apps/web/src/components/layout/user-menu-actions.tsx` (client dropdown)

Context: the current `UserMenu` (server component) shows `Sign in` (→ `/sign-in`) or the email text. Replace the signed-in branch with a dropdown (`dropdown-menu-custom` + `avatar-custom`) exposing an **Account** link (→ `/account`, lands in C2) and **Sign out** (calls `signOutAction` then refreshes). The dropdown must be a CLIENT component; the server `UserMenu` passes the email down.

- [ ] **Step 1: Create** `apps/web/src/components/layout/user-menu-actions.tsx`

```tsx
"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@tourism/ui/components/custom/dropdown-menu-custom";
import { Avatar, AvatarFallback } from "@tourism/ui/components/custom/avatar-custom";
import { signOutAction } from "@/features/auth/actions";

/** Client dropdown for the signed-in user: Account link + Sign out. */
export function UserMenuActions({ email }: { email: string }) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initial = email.charAt(0).toUpperCase();

  function onSignOut() {
    startTransition(async () => {
      await signOutAction();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2" aria-label={email}>
        <Avatar className="size-8">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="max-w-48 truncate" data-testid="user-email">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/account" />} nativeButton={false}>
          {t("account")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSignOut} disabled={pending}>
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```
(CONFIRM the real exports/props of `dropdown-menu-custom` and `avatar-custom` in `packages/ui/src/components/custom/` — names like `DropdownMenuTrigger`/`AvatarFallback` and whether items use `render`/`nativeButton` like `button-custom`. Adapt this component to the real API; the structure above is the intent.)

- [ ] **Step 2: Modify** `apps/web/src/components/layout/user-menu.tsx` signed-in branch

```tsx
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@tourism/ui/components/custom/button-custom";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UserMenuActions } from "./user-menu-actions";

/** Server component: Sign in when logged out, a user dropdown when logged in. */
export async function UserMenu() {
  const t = await getTranslations("Nav");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Button nativeButton={false} render={<Link href="/sign-in" />}>
        {t("signIn")}
      </Button>
    );
  }
  return <UserMenuActions email={user.email ?? ""} />;
}
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @tourism/web typecheck` → clean; `pnpm --filter @tourism/web lint` → no new errors; `pnpm --filter @tourism/web test` → still green.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/layout/user-menu.tsx apps/web/src/components/layout/user-menu-actions.tsx
git commit -m "feat(web): UserMenu dropdown with Account link + Sign out"
```

---

## Task 10: Verification (Definition of Done for C1)

**Files:** none (verification + fixes only).

- [ ] **Step 1: Static gates**

Run:
```bash
pnpm --filter @tourism/web typecheck
pnpm --filter @tourism/web lint
pnpm --filter @tourism/web test
```
Expected: typecheck clean; lint no new errors; all tests pass (new auth logic tests green; ≥80% on `schemas.ts`/`redirect.ts`/`auth-error.ts`/`actions.ts`). Fix anything red before proceeding.

- [ ] **Step 2: Run backend + web**

```bash
pnpm --filter @tourism/api start:dev   # port 3000 (background)
pnpm --filter @tourism/web dev         # port 3001 (background)
```

- [ ] **Step 3: Manual browser checks** (use Playwright or a browser)

Verify and note results:
1. `/en/sign-up` → invalid email/short password show inline localized errors; valid submit either
   signs in (confirm-email OFF → redirect `/`) or shows "Check your email" (confirm-email ON).
2. After sign-in, the local user row exists — `GET /users/me` returns 200 (sync ran), not 401.
3. `/en/sign-in` with a known account redirects to `returnTo` ‖ `/`; `/en/sign-in?returnTo=/tours`
   lands on `/en/tours`; `/en/sign-in?returnTo=//evil.com` falls back to `/`. Wrong password shows
   "Wrong email or password."
4. `/en/forgot-password` → "Check your email"; the recovery link opens `/auth/callback` → lands on
   `/reset-password`; setting a new password then signing in with it works.
5. `UserMenu` shows the avatar/email dropdown with a working **Sign out**; a signed-in user visiting
   `/en/sign-in` is redirected to `/` (the `(auth)` layout guard).
6. `/vi/sign-in`, `/vi/sign-up` etc. render Vietnamese copy.
7. No console errors across the flows.

- [ ] **Step 4: Confirm C2/C3/C4 seams present (not built)**

- `/auth/callback` + `next` work (used by recovery now; ready for Google C3).
- `GoogleButton` renders disabled with the "coming soon" title (C3 will wire it).
- `UserMenu` Account link points to `/account` (C2 will add the page).
- Sign-in flow is the place C4 will insert the AAL/2FA-challenge check.

- [ ] **Step 5: Stop servers; final commit if fixes were made**

```bash
git add -A
git commit -m "test(web): C1 core auth verification fixes"   # only if Step 1-3 required fixes
```

---

## Definition of Done

- All 10 tasks complete; per-task spec + code-quality reviews passed.
- `typecheck` clean, `lint` no new errors, full Vitest suite green (auth logic ≥80%).
- Browser-verified: sign-up/verify, sign-in (+returnTo), forgot/reset, sign-out, signed-in
  redirect-away, EN/VI, no console errors; `/auth/sync` mirrored the user.
- Seams for C2 (Account link), C3 (Google + callback), C4 (sign-in AAL) in place.
- Rebase-and-merged to `master` after final review (confirm before push); branch deleted.
```
