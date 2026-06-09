# Customer FE — Auth Layout Polish (C1.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the C1 auth pages to a full-screen, chrome-free **two-column split** (brand panel left + form right) by introducing a `(site)` route group for the chrome and an `AuthShell`/`AuthBrandPanel` for auth — without touching any auth logic.

**Architecture:** Move the public/browse routes into `app/[locale]/(site)/` whose `layout.tsx` carries `SiteHeader`/`SiteFooter`; slim `[locale]/layout.tsx` to `<html>/<body>` + providers. The `(auth)` group stays chrome-free and wraps its pages in a new `AuthShell` (split grid: `AuthBrandPanel` on the left at `lg+`, centered form column on the right). `AuthCard` slims to just the form header + content. All colors use existing theme tokens — no hex.

**Tech Stack:** Next.js 16 App Router (route groups, RSC), next-intl (EN/VI), `next/image` (Cloudinary), Tailwind v4 + `@tourism/ui` theme tokens, Vitest (existing suite only).

**Spec:** `docs/superpowers/specs/2026-06-09-customer-fe-auth-layout-polish-design.md`

**Conventions:** Repo root `c:\develop\Apps\Main-Projects\tourism-be-api`. Branch `feat/customer-fe-auth-layout-polish` (already checked out — do NOT switch). Windows + PowerShell; absolute paths; do not `cd`; bracket/paren paths MUST be quoted. App cmd prefix `pnpm --filter @tourism/web`. `@/` → `apps/web/src`. Cost-monitor hook is DISABLED — ignore cost warnings and finish each task. **Colors: theme tokens only** (`bg-primary`, `text-primary-foreground`, `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `ring-ring`, …) — NEVER hardcode hex/rgb. This is a layout refactor: no new unit tests; the 77-test suite must stay green and each task is verified by typecheck + lint (+ browser at the end).

---

## File Structure

```text
apps/web/src/app/[locale]/
  layout.tsx                       # MODIFY: drop SiteHeader/SiteFooter; keep <html>/<body> + providers + fonts + generateStaticParams
  (site)/
    layout.tsx                     # CREATE: SiteHeader + <div flex-1>{children}</div> + SiteFooter
    page.tsx                       # MOVE from [locale]/page.tsx
    tours/                         # MOVE
    destinations/                  # MOVE
    playground/                    # MOVE
    error.tsx loading.tsx not-found.tsx   # MOVE
  (auth)/
    layout.tsx                     # MODIFY: keep guard; wrap children in <AuthShell>
    sign-in/ sign-up/ forgot-password/ reset-password/   # unchanged
apps/web/src/features/auth/
  auth-brand-panel.tsx             # CREATE: next/image + brand-tint gradient + AuthBackgroundShape + logo + tagline
  auth-shell.tsx                   # CREATE: split grid (panel lg+, centered form column)
  auth-card.tsx                    # MODIFY: slim to <h1> title + subtitle + children + footer (no centering/abs-bg)
apps/web/messages/en.json, vi.json # MODIFY: + Auth.brandHeadline, Auth.brandSubline
```

---

## Task 1: `(site)` route group + move routes + slim `[locale]/layout.tsx`

**Files:**
- Create: `apps/web/src/app/[locale]/(site)/layout.tsx`
- Move: `page.tsx`, `tours/`, `destinations/`, `playground/`, `error.tsx`, `loading.tsx`, `not-found.tsx` → under `(site)/`
- Modify: `apps/web/src/app/[locale]/layout.tsx`

Context: `[locale]/layout.tsx` currently renders `<body class="flex min-h-full flex-col"><SiteHeader/><div class="flex-1">{children}</div><SiteFooter/></body>`, so every page (incl. auth) gets chrome. We move the chrome into a `(site)` group and slim the locale layout. Route groups are URL-transparent — `/en`, `/en/tours`, etc. are unchanged.

- [ ] **Step 1: Create** `apps/web/src/app/[locale]/(site)/layout.tsx`

```tsx
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

/** Chrome for the public marketing/browse pages (home, tours, destinations,
 *  playground). Auth pages live in the sibling (auth) group and have no chrome. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 2: Move the route files into `(site)/`** (use `git mv` to preserve history; quote the paths)

Run (PowerShell-safe — run each line):
```bash
git mv "apps/web/src/app/[locale]/page.tsx"      "apps/web/src/app/[locale]/(site)/page.tsx"
git mv "apps/web/src/app/[locale]/tours"         "apps/web/src/app/[locale]/(site)/tours"
git mv "apps/web/src/app/[locale]/destinations"  "apps/web/src/app/[locale]/(site)/destinations"
git mv "apps/web/src/app/[locale]/playground"    "apps/web/src/app/[locale]/(site)/playground"
git mv "apps/web/src/app/[locale]/error.tsx"     "apps/web/src/app/[locale]/(site)/error.tsx"
git mv "apps/web/src/app/[locale]/loading.tsx"   "apps/web/src/app/[locale]/(site)/loading.tsx"
git mv "apps/web/src/app/[locale]/not-found.tsx" "apps/web/src/app/[locale]/(site)/not-found.tsx"
```
Expected after: `ls "apps/web/src/app/[locale]"` shows only `(auth)`, `(site)`, `layout.tsx`. And `ls "apps/web/src/app/[locale]/(site)"` shows `layout.tsx page.tsx tours destinations playground error.tsx loading.tsx not-found.tsx`.

These moved files import via the `@/` alias (not relative `../`), so **no import paths change**. Confirm by grepping the moved files for `from "../` — if any relative parent imports exist, fix them to the new depth. (Expected: none — the app uses `@/`.)

- [ ] **Step 3: Slim** `apps/web/src/app/[locale]/layout.tsx`

Remove the `SiteHeader`/`SiteFooter` imports and usage. Keep everything else (fonts, metadata, `generateStaticParams`, locale validation, `setRequestLocale`, providers). The `<body>` keeps `flex min-h-full flex-col` (so `(site)`'s `flex-1` still works and `(auth)`'s `min-h-svh` fills). Final body:

```tsx
// ...existing imports EXCEPT remove:
//   import { SiteHeader } from '@/components/layout/site-header';
//   import { SiteFooter } from '@/components/layout/site-footer';

// ...unchanged: fonts, metadata, generateStaticParams, LocaleLayout signature,
//   locale validation, setRequestLocale ...

  return (
    <html
      lang={locale}
      className={`${bodyFont.variable} ${displayFont.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <QueryProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
```
(Only the `<SiteHeader/>` + `<div class="flex-1">` wrapper + `<SiteFooter/>` are removed — `children` now renders directly; the `(site)`/`(auth)` group layouts provide structure.)

- [ ] **Step 4: Verify**

Run:
```bash
pnpm --filter @tourism/web typecheck
pnpm --filter @tourism/web lint
pnpm --filter @tourism/web test
```
Expected: typecheck clean; lint no new errors; tests 77/77 pass.
Then a build smoke (catches RSC/route issues): `pnpm --filter @tourism/web build` should compile all routes (`/[locale]`, `/[locale]/tours`, `/[locale]/destinations`, `/[locale]/playground`, `/[locale]/sign-in`, …) with no "missing default export"/route errors. (If build is slow, at minimum typecheck+lint must pass; full browser check is Task 6.)

- [ ] **Step 5: Commit**

```bash
git add -A "apps/web/src/app/[locale]"
git commit -m "refactor(web): (site) route group for chrome; slim [locale] layout"
```
(Run `git status` first; confirm the moves are staged as renames and the two layouts changed.)

---

## Task 2: i18n — brand tagline keys

**Files:**
- Modify: `apps/web/messages/en.json`, `apps/web/messages/vi.json`

Add two keys to the existing `Auth` namespace (do not touch other keys/namespaces; keep valid JSON).

- [ ] **Step 1: Add to `en.json` `Auth`**

Add these two keys inside the `Auth` object (e.g. after `signOut`):
```json
"brandHeadline": "Discover & book unforgettable trips",
"brandSubline": "Curated destinations · transparent pricing"
```

- [ ] **Step 2: Add to `vi.json` `Auth`**

```json
"brandHeadline": "Khám phá & đặt những chuyến đi khó quên",
"brandSubline": "Điểm đến tuyển chọn · giá minh bạch"
```

- [ ] **Step 3: Verify JSON + parity**

Run:
```bash
node -e "const e=require('./apps/web/messages/en.json'),v=require('./apps/web/messages/vi.json'); console.log('en', e.Auth.brandHeadline, '|', e.Auth.brandSubline); console.log('vi', v.Auth.brandHeadline, '|', v.Auth.brandSubline); console.log('parity', Object.keys(e.Auth).length===Object.keys(v.Auth).length, 'Destinations intact', !!e.Destinations&&!!v.Destinations)"
```
Expected: prints the EN + VI strings; `parity true`; `Destinations intact true`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/en.json apps/web/messages/vi.json
git commit -m "feat(web): Auth brand tagline i18n keys (EN/VI)"
```

---

## Task 3: `AuthBrandPanel` component

**Files:**
- Create: `apps/web/src/features/auth/auth-brand-panel.tsx`

Context: decorative left panel for the split (shown `lg+`). Uses `next/image` (Cloudinary is allowlisted in `next.config.ts`), a brand-tint gradient via the **primary token**, the existing `AuthBackgroundShape`, a brand lockup (`Nav.brand`), and the localized tagline (Task 2 keys). The display font utility is `font-heading` (maps to Fraunces). No hex.

- [ ] **Step 1: Create** `apps/web/src/features/auth/auth-brand-panel.tsx`

```tsx
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import AuthBackgroundShape from "@tourism/ui/assets/svg/auth-background-shape";

// Provisional brand image — a Cloudinary built-in sample (stable on every cloud).
// Swap for a curated asset in the later whole-product redesign pass.
const BRAND_IMAGE_URL =
  "https://res.cloudinary.com/dbkgeehow/image/upload/f_auto,q_auto,w_1200/samples/landscapes/nature-mountains.jpg";

/** Decorative brand panel for the auth split layout (left column, lg+ only). */
export async function AuthBrandPanel() {
  const tNav = await getTranslations("Nav");
  const tAuth = await getTranslations("Auth");
  return (
    <div className="bg-primary text-primary-foreground relative hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between">
      <Image src={BRAND_IMAGE_URL} alt="" fill priority sizes="50vw" className="object-cover" />
      {/* brand-tint wash — token-driven, no hex */}
      <div
        className="from-primary/85 to-primary/40 absolute inset-0 bg-gradient-to-br"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute -top-16 -right-16 opacity-40" aria-hidden="true">
        <AuthBackgroundShape className="size-[28rem]" />
      </div>
      <Link href="/" className="relative z-10 w-fit text-lg font-semibold tracking-tight">
        {tNav("brand")}
      </Link>
      <div className="relative z-10 max-w-sm">
        <p className="font-heading text-3xl leading-tight font-semibold">{tAuth("brandHeadline")}</p>
        <p className="text-primary-foreground/80 mt-3 text-sm">{tAuth("brandSubline")}</p>
      </div>
    </div>
  );
}
```
Notes: `next/image fill` needs the parent `relative` (it is). The image sits behind; the gradient + shape overlay it; the logo/tagline are `relative z-10` so flex `justify-between` positions logo top + tagline bottom. `AuthBackgroundShape` spreads `className` onto its `<svg>` (verify it accepts `className` — it spreads `{...props}`; the size utility overrides its intrinsic width/height). If `size-[28rem]` doesn't visibly resize the SVG, fall back to wrapping it in a `className="size-[28rem]"` div with the SVG at `className="h-full w-full"`.

- [ ] **Step 2: Verify**

Run `pnpm --filter @tourism/web typecheck` → clean. (Visual check is Task 6.) Confirm no hex in the file: `node -e "const s=require('fs').readFileSync('apps/web/src/features/auth/auth-brand-panel.tsx','utf8'); console.log('has hex:', /#[0-9a-fA-F]{3,6}\b/.test(s))"` → expected `has hex: false`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/auth/auth-brand-panel.tsx
git commit -m "feat(web): AuthBrandPanel (image + brand-tint + shape + tagline)"
```

---

## Task 4: `AuthShell` component

**Files:**
- Create: `apps/web/src/features/auth/auth-shell.tsx`

Context: the full-viewport split. Left = `AuthBrandPanel` (it self-hides below `lg`). Right = centered form column with a compact brand lockup shown only on mobile (where the panel is hidden).

- [ ] **Step 1: Create** `apps/web/src/features/auth/auth-shell.tsx`

```tsx
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthBrandPanel } from "./auth-brand-panel";

/** Full-viewport split layout for auth pages: brand panel (lg+) + centered
 *  form column. The form column carries a compact brand lockup on mobile. */
export async function AuthShell({ children }: { children: ReactNode }) {
  const tNav = await getTranslations("Nav");
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <AuthBrandPanel />
      <div className="flex flex-col items-center justify-center px-6 py-10">
        <Link
          href="/"
          className="mb-8 text-lg font-semibold tracking-tight lg:hidden"
        >
          {tNav("brand")}
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify**

Run `pnpm --filter @tourism/web typecheck` → clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/auth/auth-shell.tsx
git commit -m "feat(web): AuthShell split layout (panel + centered form column)"
```

---

## Task 5: Slim `AuthCard` + wire `AuthShell` into the `(auth)` layout

**Files:**
- Modify: `apps/web/src/features/auth/auth-card.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/layout.tsx`

Context: `AuthCard` keeps its `{ title, subtitle, children, footer }` interface (the four pages don't change), but drops the outer centering + the absolute `AuthBackgroundShape` (now `AuthShell`/`AuthBrandPanel` own layout/visual). Title becomes an `<h1>` in the display font.

- [ ] **Step 1: Replace** `apps/web/src/features/auth/auth-card.tsx` with the slim version

```tsx
import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Header + form content for an auth page. Layout/centering/visuals are owned
 *  by AuthShell + AuthBrandPanel — this is just the titled form block. */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>
      {children}
      {footer}
    </div>
  );
}
```
(The legacy `Card*` + `AuthBackgroundShape` imports are gone. The four pages still call `<AuthCard title subtitle footer>{<Form/>}</AuthCard>` unchanged.)

- [ ] **Step 2: Wire** `AuthShell` into `apps/web/src/app/[locale]/(auth)/layout.tsx`

Keep the guard exactly; change only the return to wrap children in `AuthShell`:
```tsx
import type { ReactNode } from "react";
import { redirect } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthShell } from "@/features/auth/auth-shell";

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
  return <AuthShell>{children}</AuthShell>;
}
```

- [ ] **Step 3: Verify**

Run:
```bash
pnpm --filter @tourism/web typecheck
pnpm --filter @tourism/web lint
pnpm --filter @tourism/web test
```
Expected: typecheck clean; lint no new errors; tests 77/77 pass. Confirm no hex introduced in `auth-card.tsx`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/auth/auth-card.tsx "apps/web/src/app/[locale]/(auth)/layout.tsx"
git commit -m "feat(web): slim AuthCard + wrap (auth) pages in AuthShell"
```

---

## Task 6: Verification (Definition of Done)

**Files:** none (verification + any fixes only).

- [ ] **Step 1: Static gates**

```bash
pnpm --filter @tourism/web typecheck
pnpm --filter @tourism/web lint
pnpm --filter @tourism/web test
```
Expected: typecheck clean, lint no new errors, 77/77 tests pass.

- [ ] **Step 2: Run backend + web**

```bash
pnpm --filter @tourism/api start:dev   # port 3000 (background)
pnpm --filter @tourism/web dev         # port 3001 (background)
```
(If the dev server was already running through the deps change, clear cache first: stop it, `rm -rf apps/web/.next`, restart.)

- [ ] **Step 3: Browser checks** (Playwright or a browser), note results:

1. **Auth = split, no chrome:** `/en/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` show the brand panel on the **left** (desktop ≥1024px) + form on the right; **no site header/footer**. At a mobile width (375px) the panel is hidden and a compact brand lockup shows above the form.
2. **Site = chrome intact:** `/en` (home), `/en/tours`, `/en/destinations` still render **with** `SiteHeader` + `SiteFooter`; a bad slug (`/en/tours/does-not-exist`) shows the localized not-found **with chrome**. URLs unchanged.
3. **Auth still works:** sign in with the seeded account (`customer@example.com` / `userPassword` from `.tmp/postman.env.json`) → redirects + avatar dropdown; signed-in user visiting `/en/sign-in` bounces home (guard intact); validation + wrong-password errors still show.
4. **VI:** `/vi/sign-in` shows VI copy incl. the brand tagline; `/vi` site pages have chrome.
5. **Responsive** at 375 / 768 / 1280: no overflow; brand panel appears only ≥1024.
6. **No console errors.**

- [ ] **Step 4: Token check (no hex in new/changed auth layout files)**

```bash
node -e "const fs=require('fs');for(const f of ['apps/web/src/features/auth/auth-card.tsx','apps/web/src/features/auth/auth-shell.tsx','apps/web/src/features/auth/auth-brand-panel.tsx']){const s=fs.readFileSync(f,'utf8');console.log(f, /#[0-9a-fA-F]{3,6}\b/.test(s)?'HAS HEX':'ok (tokens only)')}"
```
Expected: all three `ok (tokens only)`.

- [ ] **Step 5: Stop servers; commit any fixes**

```bash
git add -A
git commit -m "test(web): auth layout polish verification fixes"   # only if Steps 1-3 required fixes
```

---

## Definition of Done

- All 6 tasks complete; per-task spec + code-quality reviews passed.
- typecheck clean, lint no new errors, 77/77 tests green.
- Browser-verified: auth pages are a chrome-free split (panel left ≥lg, mobile collapses), site pages keep chrome, all URLs unchanged, auth flows + guard intact, EN/VI, responsive, 0 console errors, colors token-only.
- Rebase-and-merged to `master` after final review (confirm before push); branch deleted.
```
