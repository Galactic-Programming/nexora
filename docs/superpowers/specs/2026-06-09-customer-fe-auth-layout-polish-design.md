# Customer FE — Auth Layout Polish (C1.5) — Design Spec

**Date:** 2026-06-09
**Branch:** `feat/customer-fe-auth-layout-polish`
**App:** `apps/web` (customer, Next.js 16 App Router, port 3001)
**Status:** Approved (design), pending implementation plan

> A focused **redesign of the C1 auth surface only**. C1 Core Auth (sign-in/up/forgot/reset/sign-out)
> shipped functionally but the pages render the centered card **inside the global site chrome**
> (header with a redundant "Sign in" button + footer), which feels unpolished. This pass switches the
> auth pages to a **full-screen split layout** with a brand panel, and removes the site chrome from
> auth routes — **without touching any auth logic** (forms, validation, server actions, callback, guard).
> A broader visual redesign of the whole product is planned later; this pass uses **default theme tokens
> only (no hardcoded colors)** so it folds cleanly into that future pass.

---

## 1. Goal & Scope

Make the four auth pages (`sign-in`, `sign-up`, `forgot-password`, `reset-password`) a focused,
full-viewport **two-column split**: a brand/visual panel on the **left** and the form on the right,
with no global header/footer. Responsive: the panel hides below `lg` and the form goes single-column.

**Brainstorm decisions (locked):**
- **Direction:** split full-screen, **chrome-free** (remove `SiteHeader`/`SiteFooter` from auth routes
  via a `(site)` route group). URLs unchanged.
- **Panel content:** a tour photo (`next/image`, Cloudinary) + a **brand-tint gradient wash** + the
  existing `AuthBackgroundShape` (faint) + logo + localized tagline. Panel on the **LEFT**.
- **Colors:** **default theme tokens only** (`bg-primary`, `text-primary-foreground`, `bg-background`,
  `text-foreground`, `text-muted-foreground`, `border-border`, `ring-ring`, …) from
  `@tourism/ui/globals.css`. **No hardcoded hex** — a later redesign pass will re-tune visuals.
- **Polish depth:** structural split + sensible typography (display font for titles) + spacing rhythm;
  implementer's discretion within the token system.

**In scope:**
- New `(site)` route group: move `page.tsx` (home), `tours/`, `destinations/`, `playground/`,
  `error.tsx`, `loading.tsx`, `not-found.tsx` into `app/[locale]/(site)/`; add `(site)/layout.tsx`
  carrying `SiteHeader` + `SiteFooter`. Slim `[locale]/layout.tsx` to `<html>/<body>` + providers + fonts.
- New `AuthShell` (split 2-col) + `AuthBrandPanel`; slim `AuthCard` to header + content (drop the
  outer centering + absolute background — the shell owns layout).
- `(auth)/layout.tsx` keeps the signed-in guard and wraps children in `AuthShell`.
- Two i18n keys for the brand tagline (EN/VI).
- Browser verification of all moved routes + auth flows (desktop + mobile, EN/VI).

**Out of scope (unchanged / deferred):**
- All auth **logic**: forms, `schemas`, `redirect`, `auth-error`, `actions` (syncUser/signOut),
  `/auth/callback`, the guard, `PasswordField`, `GoogleButton` (C3 seam), `/account` link (C2 seam).
- Final visual tuning (exact palette, imagery, motion) — the later whole-product redesign pass.
- Admin app; any backend change.

---

## 2. Current structure (facts)

- `app/[locale]/layout.tsx` renders `<html><body class="flex min-h-full flex-col"><SiteHeader/>
  <div class="flex-1">{children}</div><SiteFooter/></body>` → **every** page (incl. auth) gets chrome.
- `(auth)/layout.tsx` = signed-in→home guard only; renders `{children}` (inherits chrome).
- Each auth page: `<AuthCard title subtitle footer>{<XForm/>}</AuthCard>`; `AuthCard` centers a
  `Card sm:max-w-md` over an absolute `AuthBackgroundShape`.
- Routes currently under `[locale]/`: `page.tsx`, `tours/`, `destinations/`, `playground/`,
  `error.tsx`, `loading.tsx`, `not-found.tsx`, `layout.tsx`, `(auth)/`.
- Theme tokens live in `@tourism/ui/globals.css` (shadcn-style: primary/background/foreground/card/
  muted/border/ring/accent/secondary + `-foreground` pairs). `AuthBackgroundShape` already paints with
  `var(--primary)`.

---

## 3. Target architecture & directory layout (`apps/web/src/`)

```text
app/[locale]/
  layout.tsx                         # SLIM: <html><body> + NextIntl/Query/Tooltip providers + fonts. NO header/footer.
  (site)/
    layout.tsx                       # NEW: <SiteHeader/> + <div flex-1>{children}</div> + <SiteFooter/>
    page.tsx                         # moved (home)
    tours/...                        # moved (page, [slug], loading)
    destinations/...                 # moved (page, [slug], loading)
    playground/page.tsx              # moved
    error.tsx, loading.tsx, not-found.tsx   # moved (so site error/404/loading keep chrome)
  (auth)/
    layout.tsx                       # guard (unchanged) + wrap children in <AuthShell>
    sign-in/ sign-up/ forgot-password/ reset-password/   # pages unchanged except via AuthCard
features/auth/
  auth-shell.tsx                     # NEW: full-viewport 2-col split; left = <AuthBrandPanel/> (hidden lg:flex), right = centered {children}
  auth-brand-panel.tsx               # NEW: next/image Cloudinary + brand-tint gradient + AuthBackgroundShape + logo + tagline (i18n)
  auth-card.tsx                      # SLIM: title (display font) + subtitle + {children} + {footer}; no centering/abs-bg
messages/en.json, vi.json            # + Auth.brandHeadline, Auth.brandSubline
```

Rationale: the chrome lives in `(site)/layout.tsx`; `(auth)` is chrome-free and owns its split shell.
Route groups are URL-transparent, so `/en`, `/en/tours`, `/en/sign-in`, etc. are all unchanged.
Auth pages already delegate to `AuthCard`, so only the shell/card wrappers change — the forms don't.

---

## 4. Components

- **`AuthShell({ children })`** (server): `min-h-svh grid lg:grid-cols-2`. Left cell = `<AuthBrandPanel/>`
  with `hidden lg:flex`. Right cell = a centered container (`flex items-center justify-center px-6 py-10`)
  rendering `{children}` constrained to ~`max-w-sm`/`max-w-md`. On mobile (`< lg`) only the right cell
  shows; a compact brand lockup (logo) sits at the top of the form column.
- **`AuthBrandPanel`** (server): `relative` panel; `next/image` (`fill`, `object-cover`,
  `priority`) of a constant Cloudinary URL (provisional sample landscape, easy to swap); an absolute
  overlay using the **primary token** as a translucent gradient wash (e.g. `bg-primary/70` /
  `bg-gradient-to-br from-primary/80 to-primary/40` — token-driven, no hex); the `AuthBackgroundShape`
  faint; a logo lockup top-left and a localized tagline (`brandHeadline` in display font +
  `brandSubline` in `text-primary-foreground/80`). All text uses `text-primary-foreground`.
- **`AuthCard`** (slimmed, server): keep the `{ title, subtitle, children, footer }` interface so the
  four pages don't change; render title in the **display font** (`font-display`/`font-heading` as the
  app already uses), subtitle in `text-muted-foreground`, then `{children}` + `{footer}` with the
  existing vertical spacing. Remove the outer `min-h-[80vh] flex center` wrapper and the absolute
  `AuthBackgroundShape` (now the panel's job).
- **`(auth)/layout.tsx`**: unchanged guard; wrap the returned `{children}` in `<AuthShell>`.

Everything stays a server component except where already client (forms). No new client components.

---

## 5. Responsive & a11y

- `lg` breakpoint splits; below it the brand panel is `hidden` and the form is single-column,
  full-width within `max-w-sm`, with a small logo at top so brand is still present.
- Brand panel is decorative: the image carries an empty/meaningful `alt`, and the panel is not a
  navigation landmark; the form remains the primary content. Existing form a11y (labels,
  `aria-invalid`/`aria-describedby`, focus rings) is untouched.
- `min-h-svh` (small-viewport height) so mobile browsers don't clip; no layout shift.

---

## 6. Reuse & tokens

- Reuse: `next/image` (Cloudinary already allowlisted), `AuthBackgroundShape`, the existing fonts
  (`--font-display`/Fraunces, `--font-body`), `AuthCard` interface, all forms.
- **Tokens only:** every color via Tailwind utilities mapped to `@tourism/ui` theme vars
  (`bg-primary`, `text-primary-foreground`, `bg-background`, `bg-card`, `text-foreground`,
  `text-muted-foreground`, `border-border`, `ring-ring`). No literal hex/rgb. This guarantees the
  later redesign pass can re-skin by changing tokens alone.

---

## 7. i18n

Add to the `Auth` namespace (EN/VI): `brandHeadline` (e.g. EN "Discover & book unforgettable trips" /
VI "Khám phá & đặt những chuyến đi khó quên") and `brandSubline` (EN "Curated destinations ·
transparent pricing" / VI "Điểm đến tuyển chọn · giá minh bạch"). No other namespace changes.

---

## 8. Testing & verification (Definition of Done)

- `pnpm --filter @tourism/web typecheck` clean; `pnpm --filter @tourism/web lint` no new errors;
  `pnpm --filter @tourism/web test` green (77/77 — forms unchanged; no new unit tests needed since this
  is layout-only, verified in browser).
- Browser (backend + web running), **EN and VI, desktop + mobile viewport**:
  1. `/en/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` render the **split** (brand panel
     left on desktop, hidden on mobile with top logo); **no site header/footer**; form works.
  2. Site routes `/en`, `/en/tours`, `/en/destinations` (and a bad slug → not-found) **still render with
     the site header + footer** and work (URLs unchanged).
  3. Sign-in with the seeded account still redirects + shows the avatar dropdown; signed-in user hitting
     `/sign-in` still bounces home (guard intact).
  4. Responsive at 375 / 768 / 1280; no overflow; no console errors.
- Colors are token-driven (spot-check: no hardcoded hex in the new files).

---

## 9. Risks

- **Route move** is the only real risk: relocating `page.tsx`/`tours`/`destinations`/`playground` +
  error/loading/not-found into `(site)/` must preserve every URL and the chrome. Mitigation: move files
  without renaming routes, keep `(site)/layout.tsx` equivalent to the old chrome markup, and
  browser-verify all routes. Auth logic is untouched, so the 77-test suite stays green.
