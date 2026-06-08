# Customer FE — B2 Package Detail — Design Spec

**Date:** 2026-06-05
**Branch:** `feat/customer-fe-browse-detail`
**App:** `apps/web` (customer, Next.js 16 App Router, port 3001)
**Status:** Approved (design), pending implementation plan

> Phase B (Browse) = **B1. Packages Archive ✅ → B2. Package Detail (this spec) → B3. Destinations**.
> Builds on A (API client, `ApiError`, layout, fonts) and B1 (`lib/api/tours.ts`, `tour-view-model`).
> Ships on its own branch, rebase-and-merged to `master` after review.

---

## 1. Goal & Scope

A **read-only** server-rendered tour detail page at `/[locale]/tours/[slug]` matching the Figma
`Package Detail Page`: hero banner → section tab-nav (Information / Tour Plan / Location / Gallery)
→ two-column Information (title + rating + summary + key-value list | "Book This Tour" sidebar)
→ Tour Plan (itinerary) → Location card → Gallery grid → Reviews list.

**In scope (B2):**

- Route `/[locale]/tours/[slug]` (RSC); `notFound()` on a 404 / unpublished slug
- Hero, sticky section tab-nav (anchor links), Information block + key-value list
- "Book This Tour" sidebar: lists **departures** (date, seats left, price) + a **stubbed** "Book Now"
  CTA (disabled/placeholder — the real booking flow is phase D)
- Tour Plan (itinerary day-by-day), Location card (destination + meeting point, no interactive map),
  Gallery grid (tour media via `next/image`), Reviews list (read-only) + average rating
- i18n (EN/VI), loading skeleton, empty states (no departures / no reviews)
- Unit tests (Vitest + RTL), ≥80% on new code

**Out of scope (deferred):**

- Booking flow (form, Stripe checkout) and Write-Review → **phase D**
- Destinations pages → **B3**
- Interactive/pin map (schema has no coordinates), review pagination controls beyond first page,
  related-tours carousel

---

## 2. Backend contract (already available, public)

- **U-07 `GET /tours/:slug`** → `TourDetailDto` = `TourWithStatsDto` + `destination: DestinationDto`
  - `itinerary: ItineraryDayDto[]` (sorted by `dayNumber`). 404 when missing/unpublished.
  Tour carries: `slug, titleEn/Vi, summaryEn/Vi, basePrice (string), currency, durationDays,
  maxGroupSize, category, difficulty, included[], excluded[], meetingPoint, media[] (url, role, type),
  averageRating, reviewsCount, peopleGoing, destination, itinerary`.
- **U-08 `GET /tours/:slug/departures`** (default `from=today`, `status=OPEN`) → `DepartureDto[]`:
  `id, startDate, endDate, priceOverride (string|null), seatsTotal, seatsBooked, status`.
  Seats left = `seatsTotal - seatsBooked`; price = `priceOverride ?? tour.basePrice`.
- **U-09 `GET /tours/:slug/reviews?page&limit`** → `PaginatedPublicReviewsDto`:
  `data: PublicReviewDto[]` (`id, rating 1–5, title (string|null), body, createdAt, userFullName`)
  - `meta` including `averageRating` (and pagination). Approved-only, newest first.

`DestinationDto`: `slug, nameEn, nameVi, country, region (nullable), descriptionEn/Vi (nullable)`.

---

## 3. Rendering & Data Flow

- **RSC, parallel fetch.** `app/[locale]/tours/[slug]/page.tsx` awaits `params` for `slug`, then
  fetches detail + departures + reviews **in parallel** (`Promise.all`) and renders `TourDetail`.
- **404 handling.** `getTour(slug)` throws `ApiError` (status 404) on a missing/unpublished slug;
  the page catches it and calls Next's `notFound()` → the existing `app/[locale]/not-found.tsx` (from A).
- **API helpers** (extend `apps/web/src/lib/api/tours.ts`, reusing `env` + `ApiError`):
  - `getTour(slug)` → `TourDetail` (single object; reuse the openapi-fetch client unwrap OR a small
    raw-envelope read — confirm which yields the `TourDetailDto` cleanly during impl).
  - `getTourDepartures(slug)` → `Departure[]` (raw-envelope read of the list).
  - `getTourReviews(slug, page?)` → `{ reviews: PublicReview[]; averageRating: number | null; meta }`
    (raw-envelope read preserving `meta`, like B1's `listTours`).
- Types for `TourDetail`, `Departure`, `PublicReview` come from the generated `schema.d.ts`
  (`components["schemas"][...]`); a `detail-view-model.ts` maps them to localized view props.

---

## 4. Architecture & Directory Layout (`apps/web/src/`)

```text
app/[locale]/tours/[slug]/
  page.tsx                 # RSC: parallel fetch -> TourDetail; notFound() on 404
  loading.tsx              # detail skeleton (ShimmerSkeleton)
features/tour-detail/
  tour-detail.tsx          # compose: hero + tab-nav + Information/Plan/Location/Gallery/Reviews
  detail-hero.tsx          # banner: hero image + Fraunces title + eyebrow
  detail-tab-nav.tsx       # client: sticky anchor nav (#information/#plan/#location/#gallery)
  tour-info.tsx            # title, rating, summary, key-value list (destination, duration, category,
                           #   meetingPoint, included/excluded chips)
  booking-sidebar.tsx      # "Book This Tour": departures (date, seats left, price) + stub CTA
  tour-plan.tsx            # itinerary day-by-day
  tour-location.tsx        # location card (destination name/region/country + meetingPoint)
  tour-gallery.tsx         # gallery grid from media (next/image, Cloudinary)
  tour-reviews.tsx         # reviews list + average rating + empty state
  detail-view-model.ts     # DTO -> localized view props; price/seats/date formatting
lib/api/
  tours.ts (extend)        # getTour, getTourDepartures, getTourReviews + Departure/PublicReview types
messages/en.json, vi.json  # add `TourDetail` namespace
```

Rationale: one focused component per section (each independently understandable/testable);
data access stays in `lib/api/tours.ts`; mapping/formatting isolated in `detail-view-model.ts`.

---

## 5. Reuse (priority: existing components)

Before building new, reuse from `@tourism/ui`: `components/custom/rating`, `badge-custom`,
`button-custom`, `shimmer-skeleton`; legacy `card`, `tabs`, `separator`, `avatar`; and
**Shadcn Studio blocks** (`packages/ui/src/components/shadcn-studio`) for gallery/section/feature
scaffolding when one fits. Confirm exact names/props against `packages/ui/src/components/...` during
implementation; adapt rather than rebuild. Tour media images render via `next/image`
(`res.cloudinary.com` already allowlisted; tours are now seeded with media).

---

## 6. Section behaviour (Figma → data)

| Section | Source | Notes |
| --- | --- | --- |
| Hero | `media` hero + localized `title` | Fraunces heading over the hero image |
| Tab-nav | static | sticky anchor links to the four section ids |
| Information | tour fields + `averageRating`/`reviewsCount` | title, rating, summary, key-value list, included/excluded chips |
| Book This Tour (sidebar) | `getTourDepartures` | each row: date range, seats left, price (`priceOverride ?? basePrice`); **"Book Now" is a disabled stub** (phase D). Empty → "no upcoming departures" |
| Tour Plan | `itinerary[]` | day number + localized title/description |
| Location | `destination` + `meetingPoint` | name/region/country + meeting point; no interactive map |
| Gallery | `media[]` (hero+gallery) | responsive image grid |
| Reviews | `getTourReviews` | average rating + list (rating, title, body, userFullName, date); empty → "no reviews yet" |

---

## 7. Error / Loading / Empty

- 404/unpublished slug → `notFound()` (existing localized `not-found.tsx`).
- Other fetch failures throw `ApiError` → existing `app/[locale]/error.tsx` boundary.
- `loading.tsx` renders a detail skeleton (hero + content blocks).
- Empty states for departures and reviews are localized; never crash.

---

## 8. i18n

Add a `TourDetail` namespace to `messages/en.json` and `vi.json`: section titles
(Information / Tour Plan / Location / Gallery / Reviews), info labels (destination, duration,
group size, category, meeting point, included, excluded), "Book This Tour", "Check availability",
"Book now", seats-left template, price "from", departures-empty, reviews-count template,
reviews-empty, average-rating label.

---

## 9. Testing (Vitest + RTL, ≥80% on new code)

- `detail-view-model.ts` — maps a `TourDetailDto` to localized view props (EN vs VI title/summary,
  hero image from media, formatted price/duration); maps a `DepartureDto` to date range + seats-left
  - resolved price; maps a `PublicReviewDto` to display props.
- `tour-reviews.tsx` — renders a review per item + average rating; renders empty state for `[]`.
- `tour-plan.tsx` — renders one row per itinerary day; empty/absent itinerary handled.
- `booking-sidebar.tsx` — renders a row per departure with seats-left + price; renders empty state.

Playwright deferred (a "detail loads + sections render" smoke test may be added later).

---

## 10. Verification (Definition of Done for B2)

1. `pnpm --filter @tourism/web typecheck` clean.
2. `pnpm --filter @tourism/web lint` clean (no new errors).
3. `pnpm --filter @tourism/web test` green, ≥80% on new code.
4. `pnpm --filter @tourism/web dev` (backend running) → clicking a card on `/tours` opens
   `/tours/[slug]` showing hero + tab-nav + info + departures + itinerary + location + gallery
   (with real images) + reviews; `/vi/...` localized; an unknown slug renders the localized not-found;
   no console errors.
5. Layout faithfully reflects the Figma `Package Detail Page` structure (per-pixel polish is a later pass).
