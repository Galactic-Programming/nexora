# Customer FE — B3 Destinations — Design Spec

**Date:** 2026-06-08
**Branch:** `feat/customer-fe-browse-destinations`
**App:** `apps/web` (customer, Next.js 16 App Router, port 3001)
**Status:** Approved (design), pending implementation plan

> Phase B (Browse) = **B1. Packages Archive ✅ → B2. Package Detail ✅ → B3. Destinations (this spec)**.
> Builds on A (API client, `ApiError`, layout, fonts), B1 (`lib/api/tours.ts` `listTours`, `TourGrid`/`TourCard`/`toTourCardModel`, `PaginationControl`, URL-push control pattern), and the Cloudinary media seed.
> Ships on its own branch, rebase-and-merged to `master` after review. After B3, Phase B (Browse) is complete.

---

## 1. Goal & Scope

Two server-rendered destination pages, following the established editorial style (no dedicated
Figma; reuse B1 patterns):

- **List** `/[locale]/destinations` — hero + search + destination card grid + pagination.
- **Detail** `/[locale]/destinations/[slug]` — hero + destination info + a grid of the tours in
  that destination (reusing B1's `listTours({ destination })` + `TourGrid`/`TourCard`).

**In scope (B3):**

- Backend: seed 1 hero `MediaAsset` per destination (Cloudinary sample) in `seed.ts`
  (the destinations service ALREADY attaches media via `attachToOwner(DESTINATION, …)` for
  list + detail, so no service change; **verify `DestinationDto` declares `media` in the generated
  schema — if not, add the field** to the API DTO so the FE type includes it).
- FE list page (RSC): search (URL param) + pagination; FE detail page (RSC): info + tours grid.
- `lib/api/destinations.ts` (`listDestinations`, `getDestination`); extend `lib/api/tours.ts`
  (`ToursQueryInput` + `listTours`) with an optional `destination` slug.
- i18n (EN/VI), loading skeletons, empty states (no destinations / no tours), `notFound()` on 404.
- Unit tests (Vitest + RTL), ≥80% on new code.

**Out of scope (deferred):**

- Create-Your-Own-Package, About Us (separate pages, not Browse).
- Map, destination-level filters beyond search, sort UI beyond default (search + pagination only — YAGNI).
- Per-pixel visual polish (Browse ships "faithful overall layout"; polish is a later pass).

---

## 2. Backend contract (already available, public)

- **U-04 `GET /destinations`** (`page, pageSize, search, sortBy, sortOrder`; `isActive` enforced) →
  `PaginatedDestinationsDto` `{ data: DestinationDto[], meta }`.
- **U-05 `GET /destinations/:slug`** → `DestinationDto` (404 `DESTINATION_NOT_FOUND`).
- `DestinationDto`: `slug, nameEn, nameVi, country, region (nullable), descriptionEn/Vi (nullable),
  isActive, createdAt, updatedAt` + `media[]` (attached at runtime by the service; confirm the DTO
  declares it for the generated FE type).
- **U-06 `GET /tours?destination=<slug>`** → tours in a destination (reuse B1 `listTours`; add a
  `destination` field to `ToursQueryInput`).

Runtime envelopes match B1/B2: list → `{ data:[...], error, meta }`; single → `{ data:{...}, error }`.

---

## 3. Rendering & Data Flow

- **List page** `app/[locale]/destinations/page.tsx` (RSC): parse `searchParams` (`page`, `q`) via a
  small `destinations-query.ts` (zod, mirrors `tours-query.ts` but only page + q), call
  `listDestinations({ page, pageSize, search })`, render `DestinationsArchive`.
- **Detail page** `app/[locale]/destinations/[slug]/page.tsx` (RSC): await `params`, `getDestination(slug)`
  (catch `ApiError` 404 → `notFound()`), then `listTours({ destination: slug, pageSize: 6 })` in
  parallel; render `DestinationDetail` (info + `TourGrid`).
- **API helpers** `lib/api/destinations.ts` (mirror B2's `getEnvelope` pattern, reuse `env` + `ApiError`):
  - `listDestinations(query)` → `{ destinations: Destination[]; meta: PaginationMeta }`.
  - `getDestination(slug)` → `Destination` (throws `ApiError` 404 on missing/inactive).
  - Types `Destination` = `components["schemas"]["DestinationDto"]`.
- Extend `lib/api/tours.ts`: add optional `destination?: string` to `ToursQueryInput` and set it in
  `listTours`'s `URLSearchParams` when present.
- `destination-view-model.ts` maps `DestinationDto` → localized VM (name, region, country,
  description, heroImage from `media`).

---

## 4. Architecture & Directory Layout (`apps/web/src/`)

```text
app/[locale]/destinations/
  page.tsx, loading.tsx                  # list (RSC + skeleton)
  [slug]/page.tsx, [slug]/loading.tsx    # detail (RSC + skeleton; notFound on 404)
features/destinations/
  destination-view-model.ts (+ .test)    # DestinationDto -> localized VM; heroImage from media
  destination-card.tsx                   # card: hero image (next/image) + name + region/country + desc excerpt + link
  destinations-grid.tsx (+ .test)        # cards + empty state
  destinations-search.tsx                # client: search box -> URL (mirrors B1 filter push)
  destinations-archive.tsx               # shell: hero + search + grid + pagination
  destination-detail.tsx                 # hero + info + tours grid (reuse TourGrid)
  destinations-query.ts (+ .test)        # zod parse/serialize searchParams (page, q)
lib/api/
  destinations.ts (+ destinations.test)  # listDestinations, getDestination, Destination type
  tours.ts (extend)                      # ToursQueryInput.destination + listTours wiring
messages/en.json, vi.json                # Destinations namespace
seed (apps/api/prisma/seed.ts)           # + destination hero MediaAsset (sample)
```

Rationale: mirror B1/B2 structure (helper → view-model → focused components → RSC page); reuse
B1's `TourGrid`/`TourCard` for the detail's tours grid and `PaginationControl` for list pagination.

---

## 5. Reuse (priority: existing components)

- B1: `TourGrid`, `TourCard`, `toTourCardModel` (tours-in-destination grid); `PaginationControl`;
  the URL-push control pattern + `serializeToursQuery`-style approach (lighter `destinations-query`).
- `@tourism/ui`: `shimmer-skeleton`, `badge-custom`, `button-custom`, legacy `card`.
- `next/image` (Cloudinary allowlisted). **Shadcn Studio blocks** for the destinations hero/grid if a
  block fits. Confirm exact names/props during impl; adapt rather than rebuild.

---

## 6. Error / Loading / Empty / i18n

- 404/inactive slug → `notFound()` (existing localized `not-found.tsx`).
- Other fetch failures → `ApiError` → existing `error.tsx` boundary.
- Loading skeletons for list + detail; empty states ("no destinations match", "no tours yet in this
  destination"), localized, never crash.
- `Destinations` i18n namespace (EN/VI): list eyebrow/title, search placeholder, results count,
  empty states, detail "Tours in {destination}", region/country labels.

---

## 7. Testing (Vitest + RTL, ≥80% on new code)

- `destinations-query.ts` — parse defaults/invalid (page, q); serialize omits defaults.
- `lib/api/destinations.ts` — `listDestinations` returns `{destinations, meta}`; `getDestination`
  throws `ApiError(404)` on error envelope.
- `destination-view-model.ts` — EN/VI name/description, heroImage from `media` hero role.
- `destinations-grid.tsx` — a card per destination; empty state for `[]`.

Playwright deferred.

---

## 8. Verification (Definition of Done for B3)

1. `pnpm --filter @tourism/web typecheck` clean; `pnpm --filter @tourism/api typecheck` clean (seed).
2. `pnpm --filter @tourism/web lint` (no new errors); `pnpm --filter @tourism/web test` green ≥80% new.
3. `pnpm --filter @tourism/api db:seed` adds destination media.
4. `pnpm --filter @tourism/web dev` (backend running) → `/en/destinations` lists destination cards
   **with images** + search + pagination; clicking one opens `/en/destinations/[slug]` with info + a
   grid of that destination's tours (linking to B2 detail); `/vi/...` localized; unknown slug →
   localized not-found; no console errors.
5. Phase B (Browse) complete after merge.
