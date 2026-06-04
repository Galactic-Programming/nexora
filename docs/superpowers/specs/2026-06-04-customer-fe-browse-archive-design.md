# Customer FE — B1 Packages Archive — Design Spec

**Date:** 2026-06-04
**Branch:** `feat/customer-fe-browse-archive`
**App:** `apps/web` (customer, Next.js 16 App Router, port 3001)
**Status:** Approved (design), pending implementation plan

> Phase B (Browse) is decomposed into: **B1. Packages Archive → B2. Package Detail → B3. Destinations**.
> This spec is **B1** only. Each sub-project ships on its own branch and is rebase-and-merged to `master` after review.
> Builds on Foundation (A): API client, `ApiError`, layout shell, `@tourism/ui`, Be Vietnam Pro + Fraunces typography.

---

## 1. Goal & Scope

A server-rendered packages (tours) listing page at `/[locale]/tours` matching the Figma
`Packages Archive Page`: hero banner, sort toolbar, card grid, a "Plan Your Trip"
filter sidebar (search + price), and pagination. The goal of B1 is a faithful **overall
layout** for the browse experience; per-section visual fine-tuning happens iteratively after.

**In scope (B1):**

- Route `/[locale]/tours` (RSC) reading filters/sort/page from URL search params
- Sort toolbar (4 options), filter sidebar (free-text search + price range), pagination
- Card grid reusing the existing `TourCard` + `toTourCardModel` view-model
- `listTours()` API helper that preserves pagination `meta` (the A unwrap middleware drops it)
- **Fix carried from A:** render tour card hero images — configure `next/image`
  `remotePatterns` for Cloudinary so card images appear (A shipped with `img_count=0`)
- i18n (EN/VI) for all archive labels; loading skeleton; empty state; error boundary reuse
- Unit tests (Vitest + RTL), ≥80% on new code

**Out of scope (deferred):**

- Tour detail page (gallery, information, itinerary, location, departures, reviews) → **B2**
- Destinations list/detail pages → **B3**
- Category / duration / destination filters (backend supports them; B1 mirrors Figma:
  search + price + sort only — YAGNI)
- Map view, saved searches, infinite scroll

---

## 2. Backend contract (already available)

`GET /tours` (`ListToursQueryDto`) — public, `isPublished:true` enforced server-side:

- **Pagination:** `page` (≥1, default 1), `pageSize` (1–100, default 20)
- **Filters (AND-combined, all optional):** `destination` (slug), `category` (enum),
  `minPrice`, `maxPrice`, `duration` (int days), `featured` (bool), `q` (free-text,
  bilingual title+summary, ≤80 chars)
- **Sort:** `sortBy` ∈ `createdAt|basePrice|durationDays|titleEn` (default `createdAt`),
  `sortOrder` ∈ `asc|desc` (default `desc`)

Runtime response envelope: `{ data: TourWithStatsDto[], error: null, meta: { page, pageSize, total, totalPages } }`.
Each item carries `slug, titleEn/Vi, summaryEn/Vi, basePrice (string), currency, durationDays,
category, isFeatured, averageRating, reviewsCount, media[] (url, role, type), destination`.

B1 uses only: `page, pageSize, q, minPrice, maxPrice, sortBy, sortOrder`.

---

## 3. Rendering & Data Flow

- **RSC + URL search params.** `app/[locale]/tours/page.tsx` is a Server Component. It
  parses `searchParams`, builds the API query, calls `listTours()`, and renders the grid +
  pagination + sidebar. URLs are shareable and SEO-friendly.
- **Controls update the URL, server refetches.** `tour-sort-bar`, `tour-filter-sidebar`,
  and `tours-pagination` are client components that push updated search params via next-intl
  navigation (`useRouter`/`usePathname`/`useSearchParams`). The search input is **debounced**
  (~400ms) before pushing `q`.
- **Pagination needs `meta`.** A's `unwrapEnvelope` middleware intentionally drops `meta`.
  B1 adds `lib/api/tours.ts` → `listTours(query)` that fetches `GET {origin}/api/v1/tours`
  directly (not through the openapi-fetch middleware), reads the full envelope, throws
  `ApiError` on `error`, and returns `{ tours: ApiTour[]; meta: PaginationMeta }`.
  `ApiTour` and `toTourCardModel` are imported from the A feature (`features/home/tour-view-model.ts`).

---

## 4. Architecture & Directory Layout (`apps/web/src/`)

```text
app/[locale]/tours/
  page.tsx                  # RSC: parse searchParams -> listTours -> render ToursArchive
  loading.tsx               # skeleton grid (ShimmerSkeleton)
features/tours/
  tours-archive.tsx         # presentational shell: hero + toolbar + (grid | sidebar) + pagination
  tour-hero.tsx             # banner (image + Fraunces heading + eyebrow)
  tour-sort-bar.tsx         # client: 4 sort options -> URL
  tour-filter-sidebar.tsx   # client: search (q) + price (min/max) -> URL ("Plan Your Trip")
  tour-grid.tsx             # tours -> TourCard via toTourCardModel; empty state
  tours-pagination.tsx      # client: page -> URL (reuse @tourism/ui pagination-control)
  tours-query.ts            # zod: parse searchParams -> typed query; serialize query -> URLSearchParams
lib/api/
  tours.ts                  # listTours(query) -> { tours, meta }; PaginationMeta type
```

Modify:
- `apps/web/next.config.ts` — add `images.remotePatterns` for `res.cloudinary.com`.
- `apps/web/messages/en.json`, `vi.json` — `ToursArchive` namespace.
- `apps/web/src/components/layout/main-nav.tsx` / `mobile-nav.tsx` — the `/tours` link already
  exists from A; verify it points here.

Rationale: feature-first under `features/tours/`; each control is a small focused client
component with one responsibility; data access isolated in `lib/api/tours.ts`.

---

## 5. Reuse (priority: existing components)

Reuse from `@tourism/ui` and the A feature before building anything new:

- `components/custom/tour-card` (card), `toTourCardModel` (A view-model)
- `components/custom/shimmer-skeleton` (loading), `components/custom/pagination-control` (pagination)
- `components/custom/button-custom`, legacy `input` / form primitives (search, price inputs)
- **Shadcn Studio blocks** in `packages/ui/src/components/shadcn-studio` for the hero banner
  or section scaffolding when a block fits
- Verify exact component names/props against `packages/ui/src/components/{custom,legacy,shadcn-studio}`
  during implementation; adapt rather than rebuild

---

## 6. Filter / Sort / Pagination mapping (Figma → backend)

| Figma control | URL param(s) | Backend |
| --- | --- | --- |
| Date | `?sortBy=createdAt&sortOrder=desc` | `sortBy=createdAt` |
| Price Low → High | `?sortBy=basePrice&sortOrder=asc` | `basePrice asc` |
| Price High → Low | `?sortBy=basePrice&sortOrder=desc` | `basePrice desc` |
| Name (A-Z) | `?sortBy=titleEn&sortOrder=asc` | `titleEn asc` |
| Search box (sidebar) | `?q=...` | `q` |
| Filter By Price (sidebar) | `?minPrice=&maxPrice=` | `minPrice`/`maxPrice` |
| Pagination | `?page=N` | `page` |

Grid `pageSize = 9` (3×3) for layout balance. Active sort/filter state is reflected in the
controls (read from current search params). Changing any filter resets `page` to 1.

---

## 7. Error / Loading / Empty

- `app/[locale]/tours/loading.tsx` renders a skeleton card grid via `ShimmerSkeleton`.
- `listTours` failures throw `ApiError` → caught by the existing `app/[locale]/error.tsx` boundary.
- Empty results (`tours.length === 0`) render a clear localized empty state (no crash).
- Show the total result count from `meta.total`.

---

## 8. i18n

Add a `ToursArchive` namespace to `messages/en.json` and `vi.json`: page title/eyebrow,
sort labels (date / price asc / price desc / name), search placeholder, price filter labels
(min/max, apply, clear), results-count template, empty-state text, pagination aria labels.

---

## 9. Testing (Vitest + RTL, ≥80% on new code)

- `tours-query.ts` — parses raw searchParams into a valid typed query (defaults applied,
  invalid values ignored/clamped); serializes a query back to `URLSearchParams`; changing a
  filter resets `page`.
- `lib/api/tours.ts` `listTours` — on a mocked envelope returns `{ tours, meta }`; throws
  `ApiError` with code/status when `error` is present.
- `tour-grid.tsx` — renders one `TourCard` per tour; renders the empty state for `[]`.
- (Sort/filter URL building is covered via `tours-query.ts` serialization tests.)

Playwright deferred (a "tours list loads + filter changes URL" smoke test may be added later).

---

## 10. Verification (Definition of Done for B1)

1. `pnpm --filter @tourism/web typecheck` clean.
2. `pnpm --filter @tourism/web lint` clean.
3. `pnpm --filter @tourism/web test` green, ≥80% on new code.
4. `pnpm --filter @tourism/web dev` (backend running) → `/en/tours` renders real tours **with
   images**, sort toolbar + price/search sidebar change the URL and re-fetch, pagination works,
   `/vi/tours` localized, empty state shows for a no-match query.
5. Layout faithfully reflects the Figma `Packages Archive Page` at a structural level
   (hero, toolbar, grid + sidebar, pagination); per-pixel polish is a later pass.
