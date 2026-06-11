# Customer FE — Account Profile (C2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a localized `/account` page where a signed-in customer views and edits their profile (`fullName`, `phone`, `locale`) against `GET/PATCH /api/v1/users/me`, wiring up the C1 `UserMenu → Account` seam.

**Architecture:** RSC page in `app/[locale]/(site)/account/` with a reverse guard (signed-out → `sign-in?returnTo=/account`), auto-sync via the existing `syncUser()` action, and a profile fetch through a new typed `lib/api/users.ts` helper (uses `createApiClient(token)`, envelope middleware throws `ApiError` on error). A client `ProfileForm` (RHF + zod) submits to a server action `updateProfile`, which sends only changed/non-empty fields (PATCH partial-update semantics) and `revalidatePath`s. A thin `AccountShell` wraps the single Profile section, structured so Phase D adds siblings. Theme tokens only; reuse `@tourism/ui` customs.

**Tech Stack:** Next.js 16 App Router (RSC + server actions), next-intl (EN/VI), react-hook-form 7.77 + zod 4.4 + `@hookform/resolvers`, openapi-fetch typed client, Supabase SSR session, Vitest. `@tourism/ui` legacy (`Field*`, `NativeSelect`, `Button`) + custom (`PhoneInput`, `Alert*`, `Avatar*`, `ShimmerSkeleton`).

**Conventions (read before coding):**
- This is a modified Next.js — per `apps/web/AGENTS.md`, check `node_modules/next/dist/docs/` before using an unfamiliar App Router API.
- Run web tests from the repo root: `pnpm --filter @tourism/web test` (Vitest, `test` = `vitest run`). Typecheck: `pnpm --filter @tourism/web typecheck`. Lint: `pnpm --filter @tourism/web lint`.
- Custom imports: `@tourism/ui/components/custom/<name>`; legacy: `@tourism/ui/components/legacy/<name>`.
- Localized nav/redirect: `import { Link, redirect } from "@/i18n/navigation"`.
- **No hardcoded hex** — theme tokens only. **No `console.log`.** Cost-monitor hook is disabled; ignore any cost warnings.

**File structure (all under `apps/web/src/` unless noted):**
- `lib/api/users.ts` (+ `users.test.ts`) — `getMe` / `updateMe` typed helpers.
- `features/account/schema.ts` (+ `schema.test.ts`) — zod `profileSchema`.
- `features/account/build-update-body.ts` (+ `build-update-body.test.ts`) — pure diff/omit body-builder.
- `features/account/actions.ts` (+ `actions.test.ts`) — `updateProfile` server action.
- `features/account/IdentityBlock.tsx` — read-only identity (server-renderable).
- `features/account/ProfileForm.tsx` — `"use client"` RHF form.
- `features/account/AccountShell.tsx` — thin layout wrapper.
- `app/[locale]/(site)/account/page.tsx` — RSC page (guard + sync + fetch).
- `app/[locale]/(site)/account/loading.tsx` — skeleton.
- `messages/en.json`, `messages/vi.json` — `Account` namespace.
- `docs/planning/roadmap.md` — mark C2 done (final task).

---

## Task 1: API helper `lib/api/users.ts` (getMe / updateMe)

**Files:**
- Create: `apps/web/src/lib/api/users.ts`
- Test: `apps/web/src/lib/api/users.test.ts`

- [ ] **Step 1: Write the failing test**

Mirror the existing `actions.test.ts` mocking style (mock `@/lib/api/client`'s `createApiClient`).

```ts
// apps/web/src/lib/api/users.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  GET: vi.fn(),
  PATCH: vi.fn(),
  tokens: [] as (string | undefined)[],
}));

vi.mock("@/lib/api/client", () => ({
  createApiClient: (token?: string) => {
    h.tokens.push(token);
    return { GET: h.GET, PATCH: h.PATCH };
  },
}));

import { getMe, updateMe } from "./users";

beforeEach(() => {
  h.GET.mockReset();
  h.PATCH.mockReset();
  h.tokens.length = 0;
});

const user = {
  id: "u1",
  supabaseId: "s1",
  email: "c@example.com",
  fullName: "Jane",
  phone: "+84901234567",
  locale: "en",
  role: "CUSTOMER",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("getMe", () => {
  it("GETs /api/v1/users/me with the token and returns the user", async () => {
    h.GET.mockResolvedValue({ data: user });
    const res = await getMe("tok");
    expect(res.email).toBe("c@example.com");
    expect(h.GET).toHaveBeenCalledWith("/api/v1/users/me");
    expect(h.tokens).toContain("tok");
  });
  it("propagates a thrown ApiError (e.g. USER_NOT_SYNCED) from the middleware", async () => {
    const { ApiError } = await import("./errors");
    h.GET.mockRejectedValue(new ApiError("USER_NOT_SYNCED", "not synced", 401));
    await expect(getMe("tok")).rejects.toMatchObject({ name: "ApiError", code: "USER_NOT_SYNCED" });
  });
  it("throws ApiError(EMPTY) when data is missing", async () => {
    h.GET.mockResolvedValue({ data: undefined });
    await expect(getMe("tok")).rejects.toMatchObject({ name: "ApiError", code: "EMPTY" });
  });
});

describe("updateMe", () => {
  it("PATCHes /api/v1/users/me with the body and returns the updated user", async () => {
    h.PATCH.mockResolvedValue({ data: { ...user, fullName: "Janet" } });
    const res = await updateMe("tok", { fullName: "Janet" });
    expect(res.fullName).toBe("Janet");
    expect(h.PATCH).toHaveBeenCalledWith("/api/v1/users/me", { body: { fullName: "Janet" } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tourism/web test -- users.test`
Expected: FAIL — cannot find module `./users` / `getMe` is not a function.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/api/users.ts
import { createApiClient } from "./client";
import { ApiError } from "./errors";
import type { components } from "./schema";

export type User = components["schemas"]["UserDto"];
export type UpdateMeBody = components["schemas"]["UpdateMeDto"];

/**
 * Fetches the signed-in user's profile. Uses the typed client whose envelope
 * middleware throws ApiError on an error envelope — so a backend 401
 * `USER_NOT_SYNCED` surfaces here as `ApiError` with `code === "USER_NOT_SYNCED"`.
 */
export async function getMe(token: string): Promise<User> {
  const { data } = await createApiClient(token).GET("/api/v1/users/me");
  if (!data) throw new ApiError("EMPTY", "Empty /users/me response", 200);
  return data;
}

/** Partial-updates the signed-in user's profile (fullName / phone / locale). */
export async function updateMe(token: string, body: UpdateMeBody): Promise<User> {
  const { data } = await createApiClient(token).PATCH("/api/v1/users/me", { body });
  if (!data) throw new ApiError("EMPTY", "Empty /users/me PATCH response", 200);
  return data;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tourism/web test -- users.test`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api/users.ts apps/web/src/lib/api/users.test.ts
git commit -m "feat(web): typed getMe/updateMe api helpers for /users/me"
```

---

## Task 2: Profile zod schema `features/account/schema.ts`

Mirrors `UpdateMeDto`. Messages are STABLE KEYS under the `Account` i18n namespace (forms render them via `t(key)`), matching the `features/auth/schemas.ts` convention.

**Files:**
- Create: `apps/web/src/features/account/schema.ts`
- Test: `apps/web/src/features/account/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/features/account/schema.test.ts
import { describe, it, expect } from "vitest";
import { profileSchema } from "./schema";

describe("profileSchema", () => {
  it("accepts valid values", () => {
    const r = profileSchema.safeParse({ fullName: "Jane Doe", phone: "+84901234567", locale: "en" });
    expect(r.success).toBe(true);
  });
  it("accepts empty optional strings (cleared in the form, omitted later by the body-builder)", () => {
    const r = profileSchema.safeParse({ fullName: "", phone: "", locale: "vi" });
    expect(r.success).toBe(true);
  });
  it("rejects fullName longer than 120 chars", () => {
    const r = profileSchema.safeParse({ fullName: "x".repeat(121), phone: "", locale: "en" });
    expect(r.success).toBe(false);
  });
  it("rejects a non-empty phone shorter than 6 chars", () => {
    const r = profileSchema.safeParse({ fullName: "", phone: "12345", locale: "en" });
    expect(r.success).toBe(false);
  });
  it("rejects a phone longer than 20 chars", () => {
    const r = profileSchema.safeParse({ fullName: "", phone: "1".repeat(21), locale: "en" });
    expect(r.success).toBe(false);
  });
  it("rejects an invalid locale", () => {
    const r = profileSchema.safeParse({ fullName: "", phone: "", locale: "fr" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tourism/web test -- account/schema.test`
Expected: FAIL — cannot find module `./schema`.

- [ ] **Step 3: Write minimal implementation**

`phone` is optional and may be an empty string (the user cleared the field); when non-empty it must be 6–20 chars. We model this with a union of empty-string OR a 6–20 string so an empty value passes validation but a too-short value fails. `fullName` allows empty up to 120.

```ts
// apps/web/src/features/account/schema.ts
import { z } from "zod";

// Validation messages are STABLE KEYS under the `Account` i18n namespace.
// Keep keys in sync with messages/*.json (validation.fullNameMax / phoneLength).
const fullName = z.string().trim().max(120, "validation.fullNameMax");

const phone = z
  .string()
  .trim()
  .refine((v) => v === "" || (v.length >= 6 && v.length <= 20), "validation.phoneLength");

const locale = z.enum(["en", "vi"]);

export const profileSchema = z.object({ fullName, phone, locale });
export type ProfileValues = z.infer<typeof profileSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tourism/web test -- account/schema.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/account/schema.ts apps/web/src/features/account/schema.test.ts
git commit -m "feat(web): profile zod schema (fullName/phone/locale)"
```

---

## Task 3: Body-builder `features/account/build-update-body.ts`

Pure function: returns a `UpdateMeBody` with only fields that (a) changed vs the original `UserDto` AND (b) are non-empty after trim. Empty optional inputs are omitted (PATCH "absent = unchanged"; backend rejects empty `phone`). Identical inputs → empty object (the action treats that as a no-op).

**Files:**
- Create: `apps/web/src/features/account/build-update-body.ts`
- Test: `apps/web/src/features/account/build-update-body.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/features/account/build-update-body.test.ts
import { describe, it, expect } from "vitest";
import { buildUpdateBody } from "./build-update-body";

const original = { fullName: "Jane", phone: "+84901234567", locale: "en" as const };

describe("buildUpdateBody", () => {
  it("returns an empty object when nothing changed", () => {
    expect(buildUpdateBody(original, { fullName: "Jane", phone: "+84901234567", locale: "en" })).toEqual({});
  });
  it("includes only the changed fields", () => {
    expect(buildUpdateBody(original, { fullName: "Janet", phone: "+84901234567", locale: "en" })).toEqual({
      fullName: "Janet",
    });
  });
  it("includes a changed locale", () => {
    expect(buildUpdateBody(original, { fullName: "Jane", phone: "+84901234567", locale: "vi" })).toEqual({
      locale: "vi",
    });
  });
  it("omits an emptied optional field (cannot clear in C2)", () => {
    // user cleared phone -> omitted, NOT sent as ""
    expect(buildUpdateBody(original, { fullName: "Jane", phone: "", locale: "en" })).toEqual({});
  });
  it("trims values before comparing and emitting", () => {
    expect(buildUpdateBody(original, { fullName: "  Janet  ", phone: "+84901234567", locale: "en" })).toEqual({
      fullName: "Janet",
    });
  });
  it("treats a null original (never set) as empty baseline", () => {
    const blank = { fullName: null, phone: null, locale: "en" as const };
    expect(buildUpdateBody(blank, { fullName: "New", phone: "", locale: "en" })).toEqual({ fullName: "New" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tourism/web test -- build-update-body.test`
Expected: FAIL — cannot find module `./build-update-body`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/features/account/build-update-body.ts
import type { UpdateMeBody } from "@/lib/api/users";
import type { ProfileValues } from "./schema";

/** The subset of UserDto fields this form can read for diffing. */
export interface ProfileOriginal {
  fullName: string | null;
  phone: string | null;
  locale: "en" | "vi";
}

/**
 * Builds a PATCH body containing only fields that changed vs `original` and are
 * non-empty after trim. Empty optional inputs are omitted (the backend rejects
 * an empty phone; PATCH semantics treat an absent field as unchanged). An
 * unchanged form yields `{}`, which the caller treats as a no-op.
 */
export function buildUpdateBody(original: ProfileOriginal, values: ProfileValues): UpdateMeBody {
  const body: UpdateMeBody = {};

  const nextName = values.fullName.trim();
  if (nextName !== "" && nextName !== (original.fullName ?? "")) {
    body.fullName = nextName;
  }

  const nextPhone = values.phone.trim();
  if (nextPhone !== "" && nextPhone !== (original.phone ?? "")) {
    body.phone = nextPhone;
  }

  if (values.locale !== original.locale) {
    body.locale = values.locale;
  }

  return body;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tourism/web test -- build-update-body.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/account/build-update-body.ts apps/web/src/features/account/build-update-body.test.ts
git commit -m "feat(web): build-update-body (diff + omit empty/unchanged)"
```

---

## Task 4: Server action `features/account/actions.ts` (updateProfile)

Reads the session token, re-validates with `profileSchema` (defense in depth), builds the body, no-ops on empty body, calls `updateMe`, `revalidatePath`s the account route, and returns a typed result.

**Files:**
- Create: `apps/web/src/features/account/actions.ts`
- Test: `apps/web/src/features/account/actions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/features/account/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateMe: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getSession: h.getSession } }),
}));
vi.mock("@/lib/api/users", () => ({ updateMe: h.updateMe }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));

import { updateProfile } from "./actions";

const original = { fullName: "Jane", phone: "+84901234567", locale: "en" as const };
const validInput = { locale: "en", original, values: { fullName: "Janet", phone: "+84901234567", locale: "en" } };

beforeEach(() => {
  h.getSession.mockReset();
  h.updateMe.mockReset();
  h.revalidatePath.mockReset();
  h.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

describe("updateProfile", () => {
  it("returns NO_SESSION when there is no session", async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    expect(await updateProfile(validInput)).toEqual({ ok: false, error: "NO_SESSION" });
    expect(h.updateMe).not.toHaveBeenCalled();
  });
  it("returns VALIDATION for invalid values", async () => {
    const bad = { ...validInput, values: { fullName: "x".repeat(121), phone: "", locale: "en" } };
    expect(await updateProfile(bad)).toEqual({ ok: false, error: "VALIDATION" });
    expect(h.updateMe).not.toHaveBeenCalled();
  });
  it("no-ops (does not call updateMe) when nothing changed", async () => {
    const same = { ...validInput, values: { fullName: "Jane", phone: "+84901234567", locale: "en" } };
    expect(await updateProfile(same)).toEqual({ ok: true, noop: true });
    expect(h.updateMe).not.toHaveBeenCalled();
  });
  it("calls updateMe with the diffed body and revalidates on success", async () => {
    h.updateMe.mockResolvedValue({ ...original, fullName: "Janet" });
    expect(await updateProfile(validInput)).toEqual({ ok: true });
    expect(h.updateMe).toHaveBeenCalledWith("tok", { fullName: "Janet" });
    expect(h.revalidatePath).toHaveBeenCalledWith("/en/account");
  });
  it("returns REQUEST_FAILED when updateMe throws", async () => {
    h.updateMe.mockRejectedValue(new Error("boom"));
    expect(await updateProfile(validInput)).toEqual({ ok: false, error: "REQUEST_FAILED" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tourism/web test -- account/actions.test`
Expected: FAIL — cannot find module `./actions`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/features/account/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateMe } from "@/lib/api/users";
import { profileSchema, type ProfileValues } from "./schema";
import { buildUpdateBody, type ProfileOriginal } from "./build-update-body";

export interface UpdateProfileInput {
  /** URL locale segment, used to revalidate the correct /{locale}/account path. */
  locale: string;
  original: ProfileOriginal;
  values: ProfileValues;
}

export type UpdateProfileResult =
  | { ok: true }
  | { ok: true; noop: true }
  | { ok: false; error: "NO_SESSION" | "VALIDATION" | "REQUEST_FAILED" };

/**
 * Partial-updates the signed-in user's profile. Re-validates server-side,
 * sends only changed/non-empty fields, and no-ops when nothing changed.
 */
export async function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "NO_SESSION" };

  const parsed = profileSchema.safeParse(input.values);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  const body = buildUpdateBody(input.original, parsed.data);
  if (Object.keys(body).length === 0) return { ok: true, noop: true };

  try {
    await updateMe(session.access_token, body);
    revalidatePath(`/${input.locale}/account`);
    return { ok: true };
  } catch {
    return { ok: false, error: "REQUEST_FAILED" };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tourism/web test -- account/actions.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/account/actions.ts apps/web/src/features/account/actions.test.ts
git commit -m "feat(web): updateProfile server action (validate/diff/no-op/revalidate)"
```

---

## Task 5: i18n `Account` namespace

Add an `Account` namespace to both message files. Keys cover the shell, identity block, fields, helper/validation text, and status messages.

**Files:**
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/vi.json`

- [ ] **Step 1: Add the `Account` namespace to `messages/en.json`**

Insert as a new top-level key (e.g. after `"Auth"`):

```json
"Account": {
  "title": "My account",
  "subtitle": "Manage your profile and preferences.",
  "nav": { "profile": "Profile" },
  "identity": {
    "heading": "Account details",
    "email": "Email",
    "role": "Role",
    "memberSince": "Member since"
  },
  "role": { "CUSTOMER": "Customer", "ADMIN": "Admin" },
  "fields": {
    "fullName": "Full name",
    "fullNamePlaceholder": "Your full name",
    "phone": "Phone",
    "locale": "Preferred language",
    "localeHelp": "Used for account notifications. It does not change the language of this page.",
    "localeEn": "English",
    "localeVi": "Vietnamese"
  },
  "validation": {
    "fullNameMax": "Full name must be 120 characters or fewer.",
    "phoneLength": "Phone must be between 6 and 20 characters."
  },
  "actions": { "save": "Save changes", "saving": "Saving…" },
  "status": {
    "saved": "Your profile has been updated.",
    "noChanges": "No changes to save.",
    "error": "Something went wrong. Please try again.",
    "loadError": "We couldn't load your profile.",
    "retry": "Try again"
  }
}
```

- [ ] **Step 2: Add the `Account` namespace to `messages/vi.json`**

```json
"Account": {
  "title": "Tài khoản của tôi",
  "subtitle": "Quản lý hồ sơ và tùy chọn của bạn.",
  "nav": { "profile": "Hồ sơ" },
  "identity": {
    "heading": "Thông tin tài khoản",
    "email": "Email",
    "role": "Vai trò",
    "memberSince": "Thành viên từ"
  },
  "role": { "CUSTOMER": "Khách hàng", "ADMIN": "Quản trị viên" },
  "fields": {
    "fullName": "Họ và tên",
    "fullNamePlaceholder": "Họ và tên của bạn",
    "phone": "Số điện thoại",
    "locale": "Ngôn ngữ ưu tiên",
    "localeHelp": "Dùng cho thông báo tài khoản. Tùy chọn này không thay đổi ngôn ngữ của trang.",
    "localeEn": "Tiếng Anh",
    "localeVi": "Tiếng Việt"
  },
  "validation": {
    "fullNameMax": "Họ và tên không được vượt quá 120 ký tự.",
    "phoneLength": "Số điện thoại phải từ 6 đến 20 ký tự."
  },
  "actions": { "save": "Lưu thay đổi", "saving": "Đang lưu…" },
  "status": {
    "saved": "Hồ sơ của bạn đã được cập nhật.",
    "noChanges": "Không có thay đổi để lưu.",
    "error": "Đã xảy ra lỗi. Vui lòng thử lại.",
    "loadError": "Chúng tôi không thể tải hồ sơ của bạn.",
    "retry": "Thử lại"
  }
}
```

- [ ] **Step 3: Verify both files are valid JSON and carry the namespace**

Run:
```bash
node -e "for (const l of ['en','vi']) { const j=require('./apps/web/messages/'+l+'.json'); if(!j.Account?.title) throw new Error('missing Account in '+l); } console.log('ok')"
```
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/en.json apps/web/messages/vi.json
git commit -m "feat(web): Account i18n namespace (EN/VI)"
```

---

## Task 6: `IdentityBlock` component (read-only identity)

Server-renderable (no `"use client"`). Shows avatar + email, role (localized), and member-since. Reuses `Avatar*` custom; theme tokens only.

**Files:**
- Create: `apps/web/src/features/account/IdentityBlock.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// apps/web/src/features/account/IdentityBlock.tsx
import { getTranslations } from "next-intl/server";
import { Avatar, AvatarFallback } from "@tourism/ui/components/custom/avatar-custom";
import type { User } from "@/lib/api/users";

function initials(user: Pick<User, "fullName" | "email">): string {
  const source = user.fullName?.trim() || user.email;
  return source.slice(0, 2).toUpperCase();
}

export async function IdentityBlock({ user, locale }: { user: User; locale: string }) {
  const t = await getTranslations("Account");
  const memberSince = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
    new Date(user.createdAt),
  );

  return (
    <section
      aria-label={t("identity.heading")}
      className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4"
    >
      <Avatar>
        <AvatarFallback>{initials(user)}</AvatarFallback>
      </Avatar>
      <dl className="grid gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">{t("identity.email")}:</dt>
          <dd className="font-medium text-foreground">{user.email}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">{t("identity.role")}:</dt>
          <dd className="text-foreground">{t(`role.${user.role}`)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">{t("identity.memberSince")}:</dt>
          <dd className="text-foreground">{memberSince}</dd>
        </div>
      </dl>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @tourism/web typecheck`
Expected: PASS (no type errors). If `Avatar`/`AvatarFallback` names differ, confirm against `packages/ui/src/components/custom/avatar-custom.tsx` exports and adjust.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/account/IdentityBlock.tsx
git commit -m "feat(web): IdentityBlock read-only account identity"
```

---

## Task 7: `ProfileForm` component (client, RHF)

Editable form for `fullName` / `phone` / `locale`. RHF + `zodResolver(profileSchema)`. `phone` uses the country-aware `PhoneInput` custom via a `Controller` (it is a controlled component with `value`/`onChange`). Submits to `updateProfile`; shows success/no-op/error via `Alert` custom. Disables save while pending or when not dirty.

**Files:**
- Create: `apps/web/src/features/account/ProfileForm.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// apps/web/src/features/account/ProfileForm.tsx
"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@tourism/ui/components/legacy/field";
import { Input } from "@tourism/ui/components/legacy/input";
import { NativeSelect, NativeSelectOption } from "@tourism/ui/components/legacy/native-select";
import { Button } from "@tourism/ui/components/custom/button-custom";
import { PhoneInput } from "@tourism/ui/components/custom/phone-input";
import { Alert, AlertDescription } from "@tourism/ui/components/custom/alert-custom";
import type { User } from "@/lib/api/users";
import { profileSchema, type ProfileValues } from "./schema";
import { updateProfile } from "./actions";

type Status = "idle" | "saved" | "noChanges" | "error";

export function ProfileForm({ user }: { user: User }) {
  const t = useTranslations("Account");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("idle");

  const original = {
    fullName: user.fullName,
    phone: user.phone,
    locale: user.locale,
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user.fullName ?? "",
      phone: user.phone ?? "",
      locale: user.locale,
    },
  });

  async function onSubmit(values: ProfileValues) {
    setStatus("idle");
    const res = await updateProfile({ locale, original, values });
    if (res.ok && "noop" in res) {
      setStatus("noChanges");
      return;
    }
    if (res.ok) {
      setStatus("saved");
      reset(values); // clears dirty state; new baseline = saved values
      return;
    }
    setStatus("error");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-md">
      <FieldGroup className="gap-4">
        {status === "saved" && (
          <Alert>
            <AlertDescription>{t("status.saved")}</AlertDescription>
          </Alert>
        )}
        {status === "noChanges" && (
          <Alert>
            <AlertDescription>{t("status.noChanges")}</AlertDescription>
          </Alert>
        )}
        {status === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{t("status.error")}</AlertDescription>
          </Alert>
        )}

        <Field className="gap-2">
          <FieldLabel htmlFor="fullName">{t("fields.fullName")}</FieldLabel>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder={t("fields.fullNamePlaceholder")}
            aria-invalid={!!errors.fullName}
            {...register("fullName")}
          />
          {errors.fullName?.message ? <FieldError>{t(errors.fullName.message)}</FieldError> : null}
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor="phone">{t("fields.phone")}</FieldLabel>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <PhoneInput
                id="phone"
                value={field.value || undefined}
                onChange={(v) => field.onChange(v ?? "")}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.phone?.message ? <FieldError>{t(errors.phone.message)}</FieldError> : null}
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor="locale">{t("fields.locale")}</FieldLabel>
          <NativeSelect id="locale" {...register("locale")}>
            <NativeSelectOption value="en">{t("fields.localeEn")}</NativeSelectOption>
            <NativeSelectOption value="vi">{t("fields.localeVi")}</NativeSelectOption>
          </NativeSelect>
          <FieldDescription>{t("fields.localeHelp")}</FieldDescription>
        </Field>

        <Field>
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? t("actions.saving") : t("actions.save")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm --filter @tourism/web typecheck && pnpm --filter @tourism/web lint`
Expected: PASS. If a `@tourism/ui` export name or prop differs (e.g. `Alert` `variant`, `PhoneInput` `id`/`onBlur`, `NativeSelectOption`), confirm against the component source and adjust imports/props. Do NOT introduce hardcoded colors or `console.log`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/account/ProfileForm.tsx
git commit -m "feat(web): ProfileForm (RHF + zod, phone/locale, status alerts)"
```

---

## Task 8: `AccountShell` component (thin layout wrapper)

Account title/subtitle + a minimal nav list (single active "Profile" item, structured so Phase D appends siblings) + single content column. Server-renderable. Theme tokens only.

**Files:**
- Create: `apps/web/src/features/account/AccountShell.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// apps/web/src/features/account/AccountShell.tsx
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

/**
 * Thin account layout: heading + a minimal nav list (Profile only today) +
 * single content column. Structured so Phase D (e.g. Bookings) can append nav
 * items / sibling routes without re-architecting this page. Not a sidebar.
 */
export async function AccountShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("Account");
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </header>
      <nav aria-label={t("title")} className="mb-6">
        <ul className="flex gap-2 border-b border-border">
          <li>
            <span
              aria-current="page"
              className="inline-block border-b-2 border-primary px-1 pb-2 text-sm font-medium text-foreground"
            >
              {t("nav.profile")}
            </span>
          </li>
        </ul>
      </nav>
      <main>{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @tourism/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/account/AccountShell.tsx
git commit -m "feat(web): thin AccountShell layout wrapper"
```

---

## Task 9: `/account` page + loading

RSC page: reverse guard (signed-out → `sign-in?returnTo=/account`), auto-sync, fetch profile (retry once on `USER_NOT_SYNCED`), render shell + identity + form, or a load-error state. Plus a route skeleton.

**Files:**
- Create: `apps/web/src/app/[locale]/(site)/account/page.tsx`
- Create: `apps/web/src/app/[locale]/(site)/account/loading.tsx`

- [ ] **Step 1: Implement `loading.tsx`**

```tsx
// apps/web/src/app/[locale]/(site)/account/loading.tsx
import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";

export default function AccountLoading() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <ShimmerSkeleton className="mb-2 h-9 w-48" />
      <ShimmerSkeleton className="mb-8 h-5 w-72" />
      <ShimmerSkeleton className="mb-6 h-20 w-full rounded-lg" />
      <div className="max-w-md space-y-4">
        <ShimmerSkeleton className="h-10 w-full" />
        <ShimmerSkeleton className="h-10 w-full" />
        <ShimmerSkeleton className="h-10 w-full" />
        <ShimmerSkeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `page.tsx`**

Uses `getUser()` for the gate (matches the secure pattern in the `(auth)` layout) and `getSession()` for the access token. Retries once after a re-sync when `getMe` throws `USER_NOT_SYNCED`.

```tsx
// apps/web/src/app/[locale]/(site)/account/page.tsx
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncUser } from "@/features/auth/actions";
import { getMe } from "@/lib/api/users";
import { ApiError } from "@/lib/api/errors";
import { AccountShell } from "@/features/account/AccountShell";
import { IdentityBlock } from "@/features/account/IdentityBlock";
import { ProfileForm } from "@/features/account/ProfileForm";
import { Alert, AlertDescription, AlertTitle } from "@tourism/ui/components/custom/alert-custom";

async function loadProfile(token: string) {
  try {
    return await getMe(token);
  } catch (err) {
    if (ApiError.isApiError(err) && err.code === "USER_NOT_SYNCED") {
      await syncUser();
      return await getMe(token); // single retry after the mirror lands
    }
    throw err;
  }
}

export default async function AccountPage({
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
  if (!user) redirect({ href: "/sign-in?returnTo=/account", locale });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect({ href: "/sign-in?returnTo=/account", locale });

  // Ensure the user is mirrored before reading the profile.
  await syncUser();

  const t = await getTranslations("Account");
  try {
    const profile = await loadProfile(session.access_token);
    return (
      <AccountShell>
        <div className="space-y-8">
          <IdentityBlock user={profile} locale={locale} />
          <ProfileForm user={profile} />
        </div>
      </AccountShell>
    );
  } catch {
    return (
      <AccountShell>
        <Alert variant="destructive">
          <AlertTitle>{t("status.loadError")}</AlertTitle>
          <AlertDescription>
            <Link href="/account" className="underline">
              {t("status.retry")}
            </Link>
          </AlertDescription>
        </Alert>
      </AccountShell>
    );
  }
}
```

- [ ] **Step 3: Typecheck + lint + full test run**

Run: `pnpm --filter @tourism/web typecheck && pnpm --filter @tourism/web lint && pnpm --filter @tourism/web test`
Expected: typecheck/lint clean; all tests pass (existing 77 + the new account/users tests).

Notes if errors:
- If `redirect({ href: "...", locale })` with a query string is rejected by the i18n navigation types, pass the object form `redirect({ href: { pathname: "/sign-in", query: { returnTo: "/account" } }, locale })`.
- If `getUser()`/`redirect` control-flow trips a "used before assigned" type error, the `redirect` calls throw (never return), so guard with an explicit `return` is unnecessary — but if the typechecker disagrees, assign after the guards.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/(site)/account/page.tsx" "apps/web/src/app/[locale]/(site)/account/loading.tsx"
git commit -m "feat(web): /account page (guard + auto-sync + profile) and skeleton"
```

---

## Task 10: Browser verification, roadmap update, finalize

**Files:**
- Modify: `docs/planning/roadmap.md`

- [ ] **Step 1: Start backend + web for manual verification**

In separate terminals (per the run notes; clear stale `.next` and free port 3001 if `EADDRINUSE`):
```bash
pnpm --filter @tourism/api start:dev      # port 3000
pnpm --filter @tourism/web dev            # port 3001
```

- [ ] **Step 2: Verify the signed-out redirect**

While signed out, navigate to `http://localhost:3001/en/account`.
Expected: redirected to `/en/sign-in?returnTo=/account`. After signing in as `customer@example.com` (password = `userPassword` in `.tmp/postman.env.json`), you land back on `/en/account`.

- [ ] **Step 3: Verify load + edit + persist (EN and VI)**

On `/en/account` and `/vi/account`:
- Identity block shows email, role, member-since; form is pre-filled.
- Change `fullName`, `phone`, and `locale` → Save → success alert.
- Reload the page → the new values persist (proves the PATCH hit the backend).
- Save again without changes → "no changes" message, no error.
- Confirm the browser console is clean (no errors/warnings) and there is no layout shift.

- [ ] **Step 4: Mark C2 done in the roadmap**

Edit the `Customer FE — C2. Account profile` row in `docs/planning/roadmap.md` (currently `⬜ Not started`). Set it to `✅ Done` with a one-line summary and link the spec + plan, matching the C1/C1.5 row style. Example replacement for that row:

```markdown
| Customer FE — C2. Account profile | `apps/web` | ✅ Done on `feat/customer-fe-account-profile` (RSC `/account`: reverse guard → `sign-in?returnTo=/account`, auto-sync + `getMe` (retry on USER_NOT_SYNCED), read-only identity, RHF+zod ProfileForm editing fullName/phone/locale via `PATCH /users/me` with diff/omit body-builder + `updateProfile` action; thin AccountShell; EN/VI; theme tokens only; new logic unit-tested). | [specs/2026-06-11-customer-fe-account-profile-design.md](../superpowers/specs/2026-06-11-customer-fe-account-profile-design.md), [plans/2026-06-11-customer-fe-account-profile.md](../superpowers/plans/2026-06-11-customer-fe-account-profile.md) |
```

- [ ] **Step 5: Commit**

```bash
git add docs/planning/roadmap.md
git commit -m "docs: mark C2 Account profile done"
```

- [ ] **Step 6: Final whole-branch review + merge gate**

Run a final review of the whole branch diff vs `master`. Then STOP and present results to the user for approval before rebasing/merging (per the feature-branch workflow: rebase-and-merge, confirm before push, then delete the branch).

---

## Self-Review notes (author)

- **Spec coverage:** §1 scope → Tasks 1–9; shell (Task 8) + single-column form (Task 7); locale persist-only (no redirect) — Task 7 sends `locale` in the body, no URL change; USER_NOT_SYNCED auto-sync+retry (Task 9 `loadProfile`); phone-clear omit limitation (Task 3 body-builder + tests); reverse guard with returnTo (Task 9); typed `createApiClient` helper (Task 1); i18n EN/VI (Task 5); TDD for logic (Tasks 1–4); browser verify (Task 10). All covered.
- **Type consistency:** `User` / `UpdateMeBody` (Task 1) reused in Tasks 3/4/6/7/9. `ProfileValues` (Task 2) → Tasks 3/4/7. `ProfileOriginal` (Task 3) → Task 4. `UpdateProfileInput`/`UpdateProfileResult` (Task 4) → Task 7. `profileSchema` keys (`validation.fullNameMax`, `validation.phoneLength`) match the i18n keys in Task 5.
- **Placeholder scan:** none — every code step shows complete code; component-name/prop fallbacks are explicit verification steps, not TODOs.
