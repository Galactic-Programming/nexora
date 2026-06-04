# Customer FE — Foundation (A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the data + auth + layout foundation for `apps/web` plus one real Home page that fetches featured tours end-to-end.

**Architecture:** Next.js 16 App Router. Public data is fetched in Server Components through a typed `openapi-fetch` client whose middleware unwraps the backend `{data,error,meta}` envelope and throws a typed `ApiError`. Supabase sessions live in cookies (`@supabase/ssr`) and refresh in `proxy.ts`. A TanStack Query provider is mounted for later client mutations. Layout shell + Home reuse `@tourism/ui`.

**Tech Stack:** Next.js 16, next-intl, Tailwind v4, `@tourism/ui`, `openapi-fetch`, `openapi-typescript`, `@supabase/ssr`, `@supabase/supabase-js`, `@tanstack/react-query`, Vitest, React Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-06-03-customer-fe-foundation-design.md`

**Branch:** `feat/customer-fe-foundation` (already created).

---

## Conventions used throughout

- Run commands from repo root `c:/develop/Apps/Main-Projects/tourism-be-api`.
- App-scoped commands use `pnpm --filter @tourism/web <script>`.
- `@/` maps to `apps/web/src/` (see `apps/web/tsconfig.json` paths — confirm before Task 1).
- UI imports use the package exports map, e.g. `@tourism/ui/components/custom/tour-card`.
- The backend must be running (`pnpm --filter @tourism/api start`) for codegen (Task 3) and manual verification (Task 9). Type/unit tests do NOT need it.

---

## Known design notes (read before starting)

1. **Envelope vs generated types.** The API `TransformInterceptor` wraps every success response as `{ "data": <DTO>, "error": null, "meta"?: {...} }` and errors as `{ "data": null, "error": { "code", "message" }, "meta"?: {...} }`. Swagger decorators describe the *inner* DTO only. Therefore `schema.d.ts` types are the inner shape; the client middleware (Task 3) unwraps `data` so callers get the inner type directly.
2. **`meta` (pagination) is intentionally dropped by the unwrap middleware in phase A.** Home needs only the tour array. List pages that need `meta` arrive in phase B and will add a dedicated `apiList()` helper then. Do not build pagination plumbing now (YAGNI).
3. **`basePrice` is a decimal serialised as a string** (e.g. `"199.00"`). The Home card maps it with `Number(tour.basePrice)`.
4. **Hero image** = `tour.media.find((m) => m.role === "hero")?.url ?? tour.media[0]?.url`.

---

## File structure (created/modified by this plan)

```text
apps/web/
  package.json                         # MODIFY: deps + scripts
  vitest.config.ts                     # CREATE
  vitest.setup.ts                      # CREATE
  .env.example                         # CREATE
  src/
    lib/
      env.ts                           # CREATE
      env.test.ts                      # CREATE
      api/
        schema.d.ts                    # CREATE (generated)
        errors.ts                      # CREATE
        errors.test.ts                 # CREATE
        client.ts                      # CREATE
        client.test.ts                 # CREATE
      supabase/
        server.ts                      # CREATE
        client.ts                      # CREATE
        middleware.ts                  # CREATE
    providers/
      query-provider.tsx               # CREATE
    components/layout/
      site-header.tsx                  # CREATE
      main-nav.tsx                     # CREATE
      mobile-nav.tsx                   # CREATE
      user-menu.tsx                    # CREATE
      site-footer.tsx                  # CREATE
    features/home/
      hero.tsx                         # CREATE
      featured-tours.tsx               # CREATE
      featured-tours.test.tsx          # CREATE
      tour-view-model.ts               # CREATE
      tour-view-model.test.ts          # CREATE
    app/[locale]/
      layout.tsx                       # MODIFY
      page.tsx                         # MODIFY
      loading.tsx                      # CREATE
      error.tsx                        # CREATE
      not-found.tsx                    # CREATE
    proxy.ts                           # MODIFY
  messages/en.json                     # MODIFY
  messages/vi.json                     # MODIFY
```

---

## Task 1: Dependencies, test tooling, env config

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`, `apps/web/vitest.setup.ts`
- Create: `apps/web/.env.example`
- Create: `apps/web/src/lib/env.ts`, `apps/web/src/lib/env.test.ts`

- [ ] **Step 1: Confirm the `@/` path alias**

Run: `cat apps/web/tsconfig.json`
Expected: a `compilerOptions.paths` entry mapping `"@/*": ["./src/*"]`. If absent, add it before continuing.

- [ ] **Step 2: Add dependencies**

Run:
```bash
pnpm --filter @tourism/web add @supabase/ssr @supabase/supabase-js @tanstack/react-query openapi-fetch
pnpm --filter @tourism/web add -D openapi-typescript vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
```
Expected: both commands exit 0 and `apps/web/package.json` lists the new deps.

- [ ] **Step 3: Add scripts to `apps/web/package.json`**

In the `"scripts"` block add:
```json
"test": "vitest run",
"test:watch": "vitest",
"api:types": "openapi-typescript http://localhost:3000/api/docs-json -o src/lib/api/schema.d.ts"
```

- [ ] **Step 4: Create `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 5: Create `apps/web/vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Write the failing test for env validation**

Create `apps/web/src/lib/env.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

const valid = {
  NEXT_PUBLIC_API_BASE_URL: "http://localhost:3000/api/v1",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("parseEnv", () => {
  it("returns typed env when all vars are present and valid", () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it("throws listing the missing variable names", () => {
    const { NEXT_PUBLIC_SUPABASE_URL: _omit, ...partial } = valid;
    expect(() => parseEnv(partial)).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("throws when API base URL is not a valid URL", () => {
    expect(() => parseEnv({ ...valid, NEXT_PUBLIC_API_BASE_URL: "not-a-url" })).toThrowError(
      /NEXT_PUBLIC_API_BASE_URL/,
    );
  });
});
```

- [ ] **Step 7: Run the test, verify it fails**

Run: `pnpm --filter @tourism/web test src/lib/env.test.ts`
Expected: FAIL — `parseEnv` is not exported / module not found.

- [ ] **Step 8: Implement `apps/web/src/lib/env.ts`**

```ts
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

/** Pure parser — unit-testable without touching process.env. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${fields}`);
  }
  return result.data;
}

export const env: Env = parseEnv({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
```

> `zod` is already a transitive dep via `@tourism/ui`, but add it explicitly: `pnpm --filter @tourism/web add zod`.

- [ ] **Step 9: Run the test, verify it passes**

Run: `pnpm --filter @tourism/web test src/lib/env.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 10: Create `apps/web/.env.example`**

```bash
# Backend REST base (NestJS global prefix /api/v1)
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
# Supabase project (Auth)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Also create a local `apps/web/.env.local` (NOT committed) with real values for verification in Task 9.

- [ ] **Step 11: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml pnpm-lock.yaml apps/web/vitest.config.ts apps/web/vitest.setup.ts apps/web/.env.example apps/web/src/lib/env.ts apps/web/src/lib/env.test.ts
git commit -m "feat(web): test tooling + typed env config"
```
(If the lockfile is at repo root only, `git add` will skip the missing app-level one — that is fine.)

---

## Task 2: Typed `ApiError`

**Files:**
- Create: `apps/web/src/lib/api/errors.ts`, `apps/web/src/lib/api/errors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/api/errors.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ApiError } from "./errors";

describe("ApiError", () => {
  it("carries code, message and status", () => {
    const err = new ApiError("TOUR_NOT_FOUND", "Tour not found", 404);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(err.code).toBe("TOUR_NOT_FOUND");
    expect(err.message).toBe("Tour not found");
    expect(err.status).toBe(404);
  });

  it("is identifiable via the static isApiError guard", () => {
    expect(ApiError.isApiError(new ApiError("X", "y", 500))).toBe(true);
    expect(ApiError.isApiError(new Error("plain"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm --filter @tourism/web test src/lib/api/errors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/lib/api/errors.ts`**

```ts
/** Typed error thrown by the API client when the backend envelope has `error`. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }

  static isApiError(value: unknown): value is ApiError {
    return value instanceof ApiError;
  }
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `pnpm --filter @tourism/web test src/lib/api/errors.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api/errors.ts apps/web/src/lib/api/errors.test.ts
git commit -m "feat(web): typed ApiError"
```

---

## Task 3: Generate API types + envelope-unwrapping client

**Files:**
- Create: `apps/web/src/lib/api/schema.d.ts` (generated)
- Create: `apps/web/src/lib/api/client.ts`, `apps/web/src/lib/api/client.test.ts`

- [ ] **Step 1: Start the backend, generate types**

Run (separate terminal): `pnpm --filter @tourism/api start`
Then: `pnpm --filter @tourism/web api:types`
Expected: `apps/web/src/lib/api/schema.d.ts` is written and contains `export interface paths` with a `/tours` GET entry. Do not edit this file by hand.

> If `/api/docs-json` 404s, confirm the Swagger path in `apps/api/src/main.ts` (`SwaggerModule.setup('api/docs', ...)` ⇒ JSON at `/api/docs-json`). The global prefix `api/v1` does NOT apply to the docs route.

- [ ] **Step 2: Write the failing test for the unwrap middleware**

Create `apps/web/src/lib/api/client.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { unwrapEnvelope } from "./client";
import { ApiError } from "./errors";

afterEach(() => vi.restoreAllMocks());

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("unwrapEnvelope", () => {
  it("returns a Response whose body is the inner data on success", async () => {
    const res = jsonResponse({ data: [{ id: "1" }], error: null });
    const out = await unwrapEnvelope(res);
    expect(await out.json()).toEqual([{ id: "1" }]);
    expect(out.status).toBe(200);
  });

  it("throws ApiError with code+status when the envelope has error", async () => {
    const res = jsonResponse(
      { data: null, error: { code: "TOUR_NOT_FOUND", message: "Tour not found" } },
      404,
    );
    await expect(unwrapEnvelope(res)).rejects.toMatchObject({
      name: "ApiError",
      code: "TOUR_NOT_FOUND",
      status: 404,
    });
    await expect(unwrapEnvelope(res.clone())).rejects.toBeInstanceOf(ApiError);
  });

  it("passes through non-JSON responses untouched", async () => {
    const res = new Response("ok", { status: 204 });
    const out = await unwrapEnvelope(res);
    expect(out.status).toBe(204);
  });
});
```

- [ ] **Step 3: Run, verify it fails**

Run: `pnpm --filter @tourism/web test src/lib/api/client.test.ts`
Expected: FAIL — `unwrapEnvelope` not exported.

- [ ] **Step 4: Implement `apps/web/src/lib/api/client.ts`**

```ts
import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";
import { env } from "../env";
import { ApiError } from "./errors";

type Envelope = {
  data: unknown;
  error: { code: string; message: string } | null;
};

/**
 * Re-wraps a backend response so openapi-fetch sees the INNER data shape that
 * the generated types describe. Throws ApiError when the envelope carries an
 * error. Non-JSON responses (e.g. 204) pass through untouched.
 */
export async function unwrapEnvelope(response: Response): Promise<Response> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = (await response.clone().json()) as Envelope;
  if (body.error) {
    throw new ApiError(body.error.code, body.error.message, response.status);
  }
  return new Response(JSON.stringify(body.data), {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}

const envelopeMiddleware: Middleware = {
  async onResponse({ response }) {
    return unwrapEnvelope(response);
  },
};

/**
 * Server-side client. Pass an Authorization header per-call for authed routes
 * (phase C/D); public routes need no token.
 */
export function createApiClient(accessToken?: string) {
  const client = createClient<paths>({
    baseUrl: env.NEXT_PUBLIC_API_BASE_URL,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  client.use(envelopeMiddleware);
  return client;
}
```

- [ ] **Step 5: Run, verify it passes**

Run: `pnpm --filter @tourism/web test src/lib/api/client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api/schema.d.ts apps/web/src/lib/api/client.ts apps/web/src/lib/api/client.test.ts
git commit -m "feat(web): generated API types + envelope-unwrapping openapi-fetch client"
```

---

## Task 4: Supabase SSR wiring + middleware

**Files:**
- Create: `apps/web/src/lib/supabase/server.ts`, `apps/web/src/lib/supabase/client.ts`, `apps/web/src/lib/supabase/middleware.ts`
- Modify: `apps/web/src/proxy.ts`

> These are thin wrappers around `@supabase/ssr` with no custom logic, so they are covered by typecheck + the Task 9 manual check rather than unit tests (mocking the cookie store adds no real signal).

- [ ] **Step 1: Implement `apps/web/src/lib/supabase/client.ts`**

```ts
import { createBrowserClient } from "@supabase/ssr";
import { env } from "../env";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
```

- [ ] **Step 2: Implement `apps/web/src/lib/supabase/server.ts`**

```ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "../env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render — safe to ignore; the
            // middleware refresh handles cookie writes.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Implement `apps/web/src/lib/supabase/middleware.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "../env";

/**
 * Refreshes the Supabase session cookie on each request and returns the
 * response carrying any updated cookies. Compose this with the i18n middleware.
 */
export async function updateSupabaseSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  await supabase.auth.getUser();
  return response;
}
```

- [ ] **Step 4: Modify `apps/web/src/proxy.ts` to compose i18n + Supabase**

Replace the file contents with:
```ts
import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSupabaseSession } from "./lib/supabase/middleware";

const handleI18n = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = handleI18n(request);
  return updateSupabaseSession(request, response);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @tourism/web typecheck`
Expected: clean (no errors).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/supabase apps/web/src/proxy.ts
git commit -m "feat(web): Supabase SSR clients + session-refresh middleware"
```

---

## Task 5: TanStack Query provider

**Files:**
- Create: `apps/web/src/providers/query-provider.tsx`

- [ ] **Step 1: Implement `apps/web/src/providers/query-provider.tsx`**

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm --filter @tourism/web typecheck`
Expected: clean.
```bash
git add apps/web/src/providers/query-provider.tsx
git commit -m "feat(web): TanStack Query provider"
```

---

## Task 6: Layout shell

**Files:**
- Create: `apps/web/src/components/layout/{site-header,main-nav,mobile-nav,user-menu,site-footer}.tsx`

> Presentational composition over `@tourism/ui`. Covered by typecheck + the Task 9 visual check. The existing `LocaleSwitcher` (`src/components/locale-switcher.tsx`) is reused.

- [ ] **Step 1: Implement `apps/web/src/components/layout/main-nav.tsx`**

```tsx
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function MainNav() {
  const t = useTranslations("Nav");
  const items = [
    { href: "/", label: t("home") },
    { href: "/tours", label: t("tours") },
    { href: "/destinations", label: t("destinations") },
  ] as const;
  return (
    <nav aria-label={t("ariaLabel")} className="hidden items-center gap-6 md:flex">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

> Confirm `@/i18n/navigation` exports `Link`. The repo has `src/i18n/navigation.ts`; if it does not yet export `Link`, add `export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);` per next-intl docs. `/tours` and `/destinations` are phase-B routes; the links may 404 until then — acceptable for foundation.

- [ ] **Step 2: Implement `apps/web/src/components/layout/user-menu.tsx`**

```tsx
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@tourism/ui/components/custom/button-custom";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Server component: shows Sign in when logged out, the email when logged in. */
export async function UserMenu() {
  const t = useTranslations("Nav");
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
  return (
    <span className="text-sm font-medium" data-testid="user-email">
      {user.email}
    </span>
  );
}
```

> `useTranslations` works in async Server Components in next-intl v4. If the installed version disallows it, swap to `const t = await getTranslations("Nav");` (import from `next-intl/server`). `/sign-in` is a phase-C route.

- [ ] **Step 3: Implement `apps/web/src/components/layout/mobile-nav.tsx`**

```tsx
"use client";

import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@tourism/ui/components/custom/button-custom";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@tourism/ui/components/legacy/sheet";

export function MobileNav() {
  const t = useTranslations("Nav");
  const [open, setOpen] = useState(false);
  const items = [
    { href: "/", label: t("home") },
    { href: "/tours", label: t("tours") },
    { href: "/destinations", label: t("destinations") },
  ] as const;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button size="icon" variant="outline" className="md:hidden" aria-label={t("openMenu")} />
        }
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetTitle>{t("ariaLabel")}</SheetTitle>
        <nav className="mt-6 flex flex-col gap-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="text-foreground text-base font-medium"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
```

> Confirm the `Sheet` API (`SheetTrigger`/`SheetContent` props) against `packages/ui/src/components/legacy/sheet.tsx`; adjust the trigger pattern (`render` vs `asChild`) to match the Base UI variant in this repo. If `Sheet` is not present, fall back to a simple toggled `<div>` panel.

- [ ] **Step 4: Implement `apps/web/src/components/layout/site-header.tsx`**

```tsx
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { MainNav } from "./main-nav";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";

export function SiteHeader() {
  const t = useTranslations("Nav");
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <MobileNav />
          <Link href="/" className="text-lg font-semibold tracking-tight">
            {t("brand")}
          </Link>
          <MainNav />
        </div>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
```

> `SiteHeader` is sync but renders the async `UserMenu` child — valid in App Router (a Server Component may render an async Server Component child).

- [ ] **Step 5: Implement `apps/web/src/components/layout/site-footer.tsx`**

```tsx
import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("Footer");
  return (
    <footer className="border-border/60 mt-auto border-t">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-1 px-4 py-8 text-sm">
        <span className="text-foreground font-semibold">{t("brand")}</span>
        <span>{t("tagline")}</span>
        <span>© {new Date().getFullYear()} {t("brand")}. {t("rights")}</span>
      </div>
    </footer>
  );
}
```

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @tourism/web typecheck`
Expected: clean (fix any import-path mismatches surfaced by the notes above).
```bash
git add apps/web/src/components/layout
git commit -m "feat(web): layout shell (header, nav, mobile nav, user menu, footer)"
```

---

## Task 7: Home feature — tour view-model + featured tours

**Files:**
- Create: `apps/web/src/features/home/tour-view-model.ts`, `tour-view-model.test.ts`
- Create: `apps/web/src/features/home/featured-tours.tsx`, `featured-tours.test.tsx`
- Create: `apps/web/src/features/home/hero.tsx`

- [ ] **Step 1: Write the failing test for the view-model mapper**

Create `apps/web/src/features/home/tour-view-model.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toTourCardModel, type ApiTour } from "./tour-view-model";

const base: ApiTour = {
  slug: "phu-quoc-sunset-cruise",
  titleEn: "Phu Quoc Sunset Cruise",
  titleVi: "Du thuyền hoàng hôn Phú Quốc",
  summaryEn: "Evening cruise",
  summaryVi: "Du thuyền buổi tối",
  basePrice: "199.00",
  currency: "USD",
  durationDays: 1,
  category: "HONEYMOON",
  isFeatured: true,
  averageRating: 4.6,
  reviewsCount: 18,
  media: [
    { url: "https://cdn/x/gallery.jpg", role: "gallery", type: "IMAGE", sortOrder: 1 },
    { url: "https://cdn/x/hero.jpg", role: "hero", type: "IMAGE", sortOrder: 0 },
  ],
} as ApiTour;

describe("toTourCardModel", () => {
  it("maps EN fields, numeric price and the hero image", () => {
    const vm = toTourCardModel(base, "en");
    expect(vm.title).toBe("Phu Quoc Sunset Cruise");
    expect(vm.summary).toBe("Evening cruise");
    expect(vm.price).toBe(199);
    expect(vm.image).toBe("https://cdn/x/hero.jpg");
    expect(vm.href).toBe("/tours/phu-quoc-sunset-cruise");
    expect(vm.locale).toBe("en-US");
  });

  it("maps VI fields and locale", () => {
    const vm = toTourCardModel(base, "vi");
    expect(vm.title).toBe("Du thuyền hoàng hôn Phú Quốc");
    expect(vm.locale).toBe("vi-VN");
  });

  it("falls back to the first media item when there is no hero role", () => {
    const noHero = { ...base, media: [base.media[0]] } as ApiTour;
    expect(toTourCardModel(noHero, "en").image).toBe("https://cdn/x/gallery.jpg");
  });

  it("uses null rating safely", () => {
    const noRating = { ...base, averageRating: null, reviewsCount: 0 } as ApiTour;
    const vm = toTourCardModel(noRating, "en");
    expect(vm.rating).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm --filter @tourism/web test src/features/home/tour-view-model.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/features/home/tour-view-model.ts`**

```ts
import type { components } from "@/lib/api/schema";
import type { TourCardProps, TourCategory } from "@tourism/ui/components/custom/tour-card";

/** Inner DTO shape returned (post-unwrap) by GET /tours items. */
export type ApiTour = components["schemas"]["TourWithStatsDto"];

const LOCALE_TAG: Record<string, string> = { en: "en-US", vi: "vi-VN" };

function heroUrl(media: ApiTour["media"]): string | undefined {
  return media.find((m) => m.role === "hero")?.url ?? media[0]?.url;
}

export function toTourCardModel(tour: ApiTour, locale: string): TourCardProps {
  return {
    href: `/tours/${tour.slug}`,
    title: locale === "vi" ? tour.titleVi : tour.titleEn,
    summary: (locale === "vi" ? tour.summaryVi : tour.summaryEn) ?? undefined,
    image: heroUrl(tour.media),
    price: Number(tour.basePrice),
    currency: tour.currency,
    locale: LOCALE_TAG[locale] ?? "en-US",
    durationDays: tour.durationDays,
    category: tour.category as TourCategory,
    featured: tour.isFeatured,
    rating: tour.averageRating ?? undefined,
    reviewCount: tour.reviewsCount,
  };
}
```

> If `components["schemas"]["TourWithStatsDto"]` does not resolve, open `schema.d.ts` and use the exact generated schema name (it mirrors the DTO class name). Keep `ApiTour` as the single source of truth so later tasks import it.

- [ ] **Step 4: Run, verify it passes**

Run: `pnpm --filter @tourism/web test src/features/home/tour-view-model.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing test for `featured-tours`**

Create `apps/web/src/features/home/featured-tours.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeaturedToursList } from "./featured-tours";
import type { ApiTour } from "./tour-view-model";

const tours: ApiTour[] = [
  {
    slug: "a",
    titleEn: "Alpha Tour",
    titleVi: "Alpha VI",
    summaryEn: "s",
    summaryVi: "s",
    basePrice: "100.00",
    currency: "USD",
    durationDays: 2,
    category: "DAY",
    isFeatured: true,
    averageRating: 4.2,
    reviewsCount: 3,
    media: [{ url: "https://cdn/a.jpg", role: "hero", type: "IMAGE", sortOrder: 0 }],
  } as ApiTour,
];

describe("FeaturedToursList", () => {
  it("renders a card per tour", () => {
    render(<FeaturedToursList tours={tours} locale="en" emptyLabel="None" />);
    expect(screen.getByText("Alpha Tour")).toBeInTheDocument();
  });

  it("renders the empty label when there are no tours", () => {
    render(<FeaturedToursList tours={[]} locale="en" emptyLabel="No featured tours yet" />);
    expect(screen.getByText("No featured tours yet")).toBeInTheDocument();
  });
});
```

> The async server component `FeaturedTours` (which does the fetch) is not unit-tested directly; its pure presentational core `FeaturedToursList` is. This keeps the fetch boundary out of jsdom.

- [ ] **Step 6: Run, verify it fails**

Run: `pnpm --filter @tourism/web test src/features/home/featured-tours.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `apps/web/src/features/home/featured-tours.tsx`**

```tsx
import { getLocale } from "next-intl/server";
import { TourCard } from "@tourism/ui/components/custom/tour-card";
import { createApiClient } from "@/lib/api/client";
import { toTourCardModel, type ApiTour } from "./tour-view-model";

export function FeaturedToursList({
  tours,
  locale,
  emptyLabel,
}: {
  tours: ApiTour[];
  locale: string;
  emptyLabel: string;
}) {
  if (tours.length === 0) {
    return <p className="text-muted-foreground py-10 text-center">{emptyLabel}</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {tours.map((tour) => (
        <TourCard key={tour.slug} className="max-w-none" {...toTourCardModel(tour, locale)} />
      ))}
    </div>
  );
}

/** Server Component: fetches featured tours and renders the list. */
export async function FeaturedTours({ emptyLabel }: { emptyLabel: string }) {
  const locale = await getLocale();
  const api = createApiClient();
  const { data } = await api.GET("/tours", {
    params: { query: { featured: true, pageSize: 6 } },
  });
  const tours = (data ?? []) as ApiTour[];
  return <FeaturedToursList tours={tours} locale={locale} emptyLabel={emptyLabel} />;
}
```

> Confirm the exact query param names (`featured`, `pageSize`) against `schema.d.ts` (generated from `ListToursQueryDto`). The post-unwrap `data` is the inner tours array. If the list endpoint nests items differently, adjust the cast — the array of `TourWithStatsDto` is what the cards consume.

- [ ] **Step 8: Run, verify it passes**

Run: `pnpm --filter @tourism/web test src/features/home/featured-tours.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 9: Implement `apps/web/src/features/home/hero.tsx`**

```tsx
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@tourism/ui/components/custom/button-custom";

export function Hero() {
  const t = useTranslations("HomePage");
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:py-24">
      <span className="text-muted-foreground text-sm tracking-widest uppercase">
        {t("eyebrow")}
      </span>
      <h1 className="text-foreground max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
        {t("title")}
      </h1>
      <p className="text-muted-foreground max-w-xl text-lg">{t("description")}</p>
      <div className="flex flex-wrap gap-3">
        <Button nativeButton={false} render={<Link href="/tours" />}>
          {t("explore")}
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/features/home
git commit -m "feat(web): home hero + featured tours (real fetch) with view-model tests"
```

---

## Task 8: Wire pages, i18n messages, error/loading/not-found

**Files:**
- Modify: `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/[locale]/page.tsx`
- Create: `apps/web/src/app/[locale]/{loading,error,not-found}.tsx`
- Modify: `apps/web/messages/en.json`, `apps/web/messages/vi.json`

- [ ] **Step 1: Add message keys to `apps/web/messages/en.json`**

Merge these keys (keep any existing `HomePage`):
```json
{
  "Nav": {
    "brand": "Tourism",
    "home": "Home",
    "tours": "Tours",
    "destinations": "Destinations",
    "signIn": "Sign in",
    "ariaLabel": "Main navigation",
    "openMenu": "Open menu"
  },
  "HomePage": {
    "eyebrow": "Curated journeys",
    "title": "Discover and book unforgettable tours",
    "description": "Handpicked destinations, transparent pricing, and instant booking.",
    "explore": "Explore tours",
    "featuredTitle": "Featured tours",
    "featuredEmpty": "No featured tours yet."
  },
  "Footer": {
    "brand": "Tourism",
    "tagline": "Curated tours across Vietnam and beyond.",
    "rights": "All rights reserved."
  },
  "Error": {
    "title": "Something went wrong",
    "description": "An unexpected error occurred. Please try again.",
    "retry": "Try again"
  },
  "NotFound": {
    "title": "Page not found",
    "description": "The page you are looking for does not exist.",
    "home": "Back to home"
  }
}
```

- [ ] **Step 2: Add the same keys (Vietnamese) to `apps/web/messages/vi.json`**

```json
{
  "Nav": {
    "brand": "Tourism",
    "home": "Trang chủ",
    "tours": "Tour",
    "destinations": "Điểm đến",
    "signIn": "Đăng nhập",
    "ariaLabel": "Điều hướng chính",
    "openMenu": "Mở menu"
  },
  "HomePage": {
    "eyebrow": "Hành trình tuyển chọn",
    "title": "Khám phá và đặt những chuyến đi khó quên",
    "description": "Điểm đến tuyển chọn, giá minh bạch, đặt chỗ tức thì.",
    "explore": "Khám phá tour",
    "featuredTitle": "Tour nổi bật",
    "featuredEmpty": "Chưa có tour nổi bật."
  },
  "Footer": {
    "brand": "Tourism",
    "tagline": "Tour tuyển chọn khắp Việt Nam và hơn thế nữa.",
    "rights": "Bảo lưu mọi quyền."
  },
  "Error": {
    "title": "Đã có lỗi xảy ra",
    "description": "Một lỗi không mong muốn đã xảy ra. Vui lòng thử lại.",
    "retry": "Thử lại"
  },
  "NotFound": {
    "title": "Không tìm thấy trang",
    "description": "Trang bạn tìm không tồn tại.",
    "home": "Về trang chủ"
  }
}
```

- [ ] **Step 3: Modify `apps/web/src/app/[locale]/layout.tsx`**

Add the shell + provider. Replace the `<body>` subtree so it wraps children with header/footer and `QueryProvider`:
```tsx
import { QueryProvider } from "@/providers/query-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
```
And inside `<body className="flex min-h-full flex-col">`:
```tsx
<NextIntlClientProvider>
  <QueryProvider>
    <TooltipProvider>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </TooltipProvider>
  </QueryProvider>
</NextIntlClientProvider>
```

- [ ] **Step 4: Modify `apps/web/src/app/[locale]/page.tsx`**

```tsx
import { use } from "react";
import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Hero } from "@/features/home/hero";
import { FeaturedTours } from "@/features/home/featured-tours";

type Props = { params: Promise<{ locale: string }> };

export default function Home({ params }: Props) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("HomePage");

  return (
    <main className="flex flex-col">
      <Hero />
      <section className="mx-auto w-full max-w-6xl px-4 pb-20">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">{t("featuredTitle")}</h2>
        <Suspense fallback={<p className="text-muted-foreground py-10 text-center">…</p>}>
          <FeaturedTours emptyLabel={t("featuredEmpty")} />
        </Suspense>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Create `apps/web/src/app/[locale]/loading.tsx`**

```tsx
import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-16 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <ShimmerSkeleton key={i} className="h-80 w-full rounded-xl" />
      ))}
    </div>
  );
}
```

> Confirm the `ShimmerSkeleton` export name/props in `packages/ui/src/components/custom/shimmer-skeleton.tsx`; if it differs, use the legacy `Skeleton` from `@tourism/ui/components/legacy/skeleton` instead.

- [ ] **Step 6: Create `apps/web/src/app/[locale]/error.tsx`**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Button } from "@tourism/ui/components/custom/button-custom";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("Error");
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <Button onClick={reset}>{t("retry")}</Button>
    </main>
  );
}
```

- [ ] **Step 7: Create `apps/web/src/app/[locale]/not-found.tsx`**

```tsx
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@tourism/ui/components/custom/button-custom";

export default function NotFound() {
  const t = useTranslations("NotFound");
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <Button nativeButton={false} render={<Link href="/" />}>
        {t("home")}
      </Button>
    </main>
  );
}
```

- [ ] **Step 8: Typecheck, lint, run all tests**

Run:
```bash
pnpm --filter @tourism/web typecheck
pnpm --filter @tourism/web lint
pnpm --filter @tourism/web test
```
Expected: all clean/green. Fix any import-path or API-shape mismatches flagged by the `>` notes in earlier tasks.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app apps/web/messages
git commit -m "feat(web): wire home page, layout shell, i18n messages, error/loading/not-found"
```

---

## Task 9: Manual verification + Definition of Done

- [ ] **Step 1: Run the backend + web dev server**

Run (two terminals):
```bash
pnpm --filter @tourism/api start
pnpm --filter @tourism/web dev
```
Open `http://localhost:3001/en`.

- [ ] **Step 2: Verify the checklist**

- [ ] Home renders the hero + a grid of **real** featured tours from the backend.
- [ ] Switching locale to `/vi` shows Vietnamese nav + VI tour titles + VND-formatted prices.
- [ ] Header sticky, mobile nav opens on small viewport, footer renders.
- [ ] `user-menu` shows "Sign in" (logged out).
- [ ] Stop the backend, reload Home → the `error.tsx` boundary shows (ApiError path), not a crash.
- [ ] Visit `http://localhost:3001/en/does-not-exist` → `not-found.tsx` renders.

- [ ] **Step 3: Re-run codegen idempotency check**

Run: `pnpm --filter @tourism/web api:types && git status --short`
Expected: `schema.d.ts` unchanged (no diff) when the backend is unchanged.

- [ ] **Step 4: Update roadmap**

In `docs/planning/roadmap.md`, change the Customer FE row to reflect Foundation (A) shipped, linking this plan. Commit:
```bash
git add docs/planning/roadmap.md
git commit -m "docs(web): mark customer FE Foundation (A) complete"
```

- [ ] **Step 5: Open PR (do not merge without approval)**

Per repo workflow, push the branch and open a PR for review; merge to `master` only after the user approves.
```bash
git push -u origin feat/customer-fe-foundation
```

---

## Self-review notes (author)

- **Spec coverage:** env (Task 1), API client + types (Task 3), ApiError (Task 2), Supabase wiring (Task 4), QueryProvider (Task 5), layout shell (Task 6), Home + featured-tours RSC (Task 7), error/loading/not-found + i18n (Task 8), verification/DoD (Task 9). All spec §1–9 covered.
- **Envelope/`meta`:** documented as a deliberate phase-B follow-up, not a placeholder.
- **Type consistency:** `ApiTour` defined once in `tour-view-model.ts` and imported by `featured-tours`; `ApiError(code, message, status)` signature identical across tasks.
- **Risk areas flagged inline with `>` notes** (Base UI `Sheet`/`Button` `render` prop, `useTranslations` in async server components, exact generated schema names, query param names). These are verify-and-adjust points, not blanks.
