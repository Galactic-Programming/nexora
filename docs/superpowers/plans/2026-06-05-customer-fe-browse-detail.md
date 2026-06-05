# Customer FE — B2 Package Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the read-only tour detail page `/[locale]/tours/[slug]` (hero, tab-nav, info, departures sidebar, itinerary, location, gallery, reviews) fed by 3 parallel public API calls.

**Architecture:** RSC page awaits `slug`, fetches detail + departures + reviews in parallel, maps DTOs to localized view props via `detail-view-model.ts`, and composes focused section components. 404 → `notFound()`. Booking is stubbed (phase D). Images via `next/image` (Cloudinary already allowlisted; tours seeded with media).

**Tech Stack:** Next.js 16 App Router, next-intl, Tailwind v4, `@tourism/ui`, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-06-05-customer-fe-browse-detail-design.md`
**Branch:** `feat/customer-fe-browse-detail` (already created).

---

## Conventions

- Run from repo root `c:/develop/Apps/Main-Projects/tourism-be-api`; app commands via `pnpm --filter @tourism/web ...`.
- `@/` → `apps/web/src/`. UI imports via package exports, e.g. `@tourism/ui/components/custom/rating`.
- Backend running for manual verification (Task 6): `pnpm --filter @tourism/api start:dev`. Unit tests do NOT need it.
- Reuse first (spec §5). Confirm exact prop names against `packages/ui/src/components/...` before adapting.
- The cost-monitor hook is disabled (`.claude/settings.json` env `ECC_DISABLED_HOOKS`), so subagents won't halt.

## Known facts (verified)

- `apps/web/src/lib/api/tours.ts` already exists (B1) with `listTours`, `PaginationMeta`, `ToursQueryInput`, and imports `env` + `ApiError`. `env.NEXT_PUBLIC_API_BASE_URL` is the backend ORIGIN (no `/api/v1`).
- Generated `apps/web/src/lib/api/schema.d.ts` (from full Swagger) includes `components["schemas"]["TourDetailDto"]`, `["DepartureDto"]`, `["PublicReviewDto"]`, `["DestinationDto"]`, `["ItineraryDayDto"]`.
- Runtime envelopes: single object → `{ data: <DTO>, error, meta? }`; list → `{ data: [...], error, meta: {...} }`. The reviews list `meta` carries `averageRating` plus pagination.
- DTO fields: `TourDetailDto` = `titleEn/Vi, summaryEn/Vi, basePrice (string), currency, durationDays, maxGroupSize, category, difficulty, included[], excluded[], meetingPoint, media[] {url,role,type}, averageRating, reviewsCount, peopleGoing, slug, destination, itinerary[]`. `DepartureDto` = `id, startDate, endDate, priceOverride (string|null), seatsTotal, seatsBooked, status`. `PublicReviewDto` = `id, rating, title (string|null), body, createdAt, userFullName (string|null)`. `DestinationDto` = `slug, nameEn, nameVi, country, region (nullable), descriptionEn/Vi (nullable)`. `ItineraryDayDto` = `dayNumber, titleEn/Vi, descriptionEn/Vi`.
- Existing `app/[locale]/not-found.tsx` + `error.tsx` (from A) are reused. `ShimmerSkeleton` = `@tourism/ui/components/custom/shimmer-skeleton`.

---

## File structure (created/modified)

```text
apps/web/
  messages/en.json, vi.json                       # MODIFY: TourDetail namespace
  src/
    lib/api/tours.ts                              # MODIFY: + getTour/getTourDepartures/getTourReviews + types
    lib/api/tour-detail.test.ts                   # CREATE
    features/tour-detail/
      detail-view-model.ts                        # CREATE
      detail-view-model.test.ts                   # CREATE
      tour-reviews.tsx + tour-reviews.test.tsx    # CREATE
      tour-plan.tsx + tour-plan.test.tsx          # CREATE
      booking-sidebar.tsx + booking-sidebar.test.tsx  # CREATE
      detail-hero.tsx                             # CREATE
      tour-info.tsx                               # CREATE
      tour-location.tsx                           # CREATE
      tour-gallery.tsx                            # CREATE
      detail-tab-nav.tsx                          # CREATE (client)
      tour-detail.tsx                             # CREATE (compose)
    app/[locale]/tours/[slug]/
      page.tsx                                    # CREATE (RSC)
      loading.tsx                                 # CREATE
```

---

## Task 1: API helpers — getTour / getTourDepartures / getTourReviews

**Files:** Modify `apps/web/src/lib/api/tours.ts`; Create `apps/web/src/lib/api/tour-detail.test.ts`.

- [ ] **Step 1: Write the failing test** — `apps/web/src/lib/api/tour-detail.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { getTour, getTourDepartures, getTourReviews } from "./tours";
import { ApiError } from "./errors";

afterEach(() => vi.restoreAllMocks());

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
    ),
  );
}

describe("getTour", () => {
  it("returns the inner tour detail object", async () => {
    mockFetch({ data: { slug: "a", titleEn: "A", media: [] }, error: null });
    const tour = await getTour("a");
    expect(tour.slug).toBe("a");
  });
  it("throws ApiError(404) for an unpublished/missing slug", async () => {
    mockFetch({ data: null, error: { code: "TOUR_NOT_FOUND", message: "not found" } }, 404);
    await expect(getTour("ghost")).rejects.toMatchObject({ name: "ApiError", status: 404, code: "TOUR_NOT_FOUND" });
  });
});

describe("getTourDepartures", () => {
  it("returns the departures array", async () => {
    mockFetch({ data: [{ id: "d1", seatsTotal: 10, seatsBooked: 3 }], error: null });
    const deps = await getTourDepartures("a");
    expect(deps).toHaveLength(1);
    expect(deps[0].id).toBe("d1");
  });
});

describe("getTourReviews", () => {
  it("returns reviews + averageRating + meta", async () => {
    mockFetch({ data: [{ id: "r1", rating: 5, body: "great" }], error: null, meta: { page: 1, pageSize: 20, total: 1, totalPages: 1, averageRating: 4.5 } });
    const res = await getTourReviews("a");
    expect(res.reviews).toHaveLength(1);
    expect(res.averageRating).toBe(4.5);
    expect(res.meta.total).toBe(1);
  });
  it("defaults averageRating to null when absent", async () => {
    mockFetch({ data: [], error: null, meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    const res = await getTourReviews("a");
    expect(res.averageRating).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter @tourism/web test src/lib/api/tour-detail.test.ts` → FAIL (exports missing).

- [ ] **Step 3: Implement** — append to `apps/web/src/lib/api/tours.ts`:
```ts
import type { components } from "./schema";

export type TourDetail = components["schemas"]["TourDetailDto"];
export type Departure = components["schemas"]["DepartureDto"];
export type PublicReview = components["schemas"]["PublicReviewDto"];

type Envelope<T> = {
  data: T | null;
  error: { code: string; message: string } | null;
  meta?: Record<string, unknown>;
};

/** Raw-envelope GET against the backend; throws ApiError on error/non-2xx/non-JSON. */
async function getEnvelope<T>(path: string): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const res = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
  });
  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError("HTTP_ERROR", `Unexpected non-JSON response (${res.status})`, res.status);
  }
  if (body.error) throw new ApiError(body.error.code, body.error.message, res.status);
  if (!res.ok) throw new ApiError("HTTP_ERROR", `Unexpected response (${res.status})`, res.status);
  if (body.data === null) throw new ApiError("EMPTY", `Empty response (${res.status})`, res.status);
  return { data: body.data, meta: body.meta };
}

export async function getTour(slug: string): Promise<TourDetail> {
  const { data } = await getEnvelope<TourDetail>(`/api/v1/tours/${encodeURIComponent(slug)}`);
  return data;
}

export async function getTourDepartures(slug: string): Promise<Departure[]> {
  const { data } = await getEnvelope<Departure[]>(
    `/api/v1/tours/${encodeURIComponent(slug)}/departures`,
  );
  return data;
}

export async function getTourReviews(
  slug: string,
  page = 1,
): Promise<{ reviews: PublicReview[]; averageRating: number | null; meta: PaginationMeta }> {
  const { data, meta } = await getEnvelope<PublicReview[]>(
    `/api/v1/tours/${encodeURIComponent(slug)}/reviews?page=${page}`,
  );
  const m = meta ?? {};
  return {
    reviews: data,
    averageRating: typeof m.averageRating === "number" ? m.averageRating : null,
    meta: {
      page: Number(m.page ?? page),
      pageSize: Number(m.pageSize ?? data.length),
      total: Number(m.total ?? data.length),
      totalPages: Number(m.totalPages ?? 1),
    },
  };
}
```

> Verify against the real endpoints during impl (backend running): the runtime list `meta` placement of `averageRating`. If the backend nests it elsewhere, adjust the extraction (keep the function signature). If `components["schemas"]["TourDetailDto"]` etc. don't resolve, open `schema.d.ts` and use the exact generated names.

- [ ] **Step 4: Run, verify pass** — `pnpm --filter @tourism/web test src/lib/api/tour-detail.test.ts` → PASS (5).

- [ ] **Step 5: Typecheck + commit**
```bash
pnpm --filter @tourism/web typecheck
git add apps/web/src/lib/api/tours.ts apps/web/src/lib/api/tour-detail.test.ts
git commit -m "feat(web): tour detail/departures/reviews API helpers"
```

---

## Task 2: detail-view-model — DTO → localized view props

**Files:** Create `apps/web/src/features/tour-detail/detail-view-model.ts`, `detail-view-model.test.ts`.

- [ ] **Step 1: Write the failing test** — `detail-view-model.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toTourDetailModel, toDepartureModel, toReviewModel } from "./detail-view-model";
import type { TourDetail, Departure, PublicReview } from "@/lib/api/tours";

const tour = {
  slug: "phu-quoc", titleEn: "Phu Quoc Cruise", titleVi: "Du thuyền Phú Quốc",
  summaryEn: "Sunset", summaryVi: "Hoàng hôn", basePrice: "199.00", currency: "USD",
  durationDays: 2, maxGroupSize: 20, category: "HONEYMOON", difficulty: "EASY",
  included: ["Hotel"], excluded: ["Flights"], meetingPoint: "Pier 1",
  averageRating: 4.6, reviewsCount: 18, peopleGoing: 124,
  media: [
    { url: "https://res.cloudinary.com/x/g.jpg", role: "gallery", type: "IMAGE", sortOrder: 1 },
    { url: "https://res.cloudinary.com/x/h.jpg", role: "hero", type: "IMAGE", sortOrder: 0 },
  ],
  destination: { slug: "phu-quoc", nameEn: "Phu Quoc", nameVi: "Phú Quốc", country: "Vietnam", region: "South" },
  itinerary: [{ dayNumber: 1, titleEn: "Day 1", titleVi: "Ngày 1", descriptionEn: "Board", descriptionVi: "Lên tàu" }],
} as unknown as TourDetail;

describe("toTourDetailModel", () => {
  it("maps EN fields, hero image, gallery, price and destination", () => {
    const vm = toTourDetailModel(tour, "en");
    expect(vm.title).toBe("Phu Quoc Cruise");
    expect(vm.heroImage).toBe("https://res.cloudinary.com/x/h.jpg");
    expect(vm.gallery).toContain("https://res.cloudinary.com/x/g.jpg");
    expect(vm.price).toBe(199);
    expect(vm.destination.name).toBe("Phu Quoc");
    expect(vm.itinerary[0].title).toBe("Day 1");
    expect(vm.rating).toBe(4.6);
  });
  it("maps VI fields", () => {
    const vm = toTourDetailModel(tour, "vi");
    expect(vm.title).toBe("Du thuyền Phú Quốc");
    expect(vm.destination.name).toBe("Phú Quốc");
    expect(vm.itinerary[0].title).toBe("Ngày 1");
  });
});

describe("toDepartureModel", () => {
  it("computes seats left and resolves price (priceOverride wins)", () => {
    const dep = { id: "d1", startDate: "2027-06-01", endDate: "2027-06-02", priceOverride: "149.00", seatsTotal: 10, seatsBooked: 7, status: "OPEN" } as Departure;
    const vm = toDepartureModel(dep, tour, "en");
    expect(vm.seatsLeft).toBe(3);
    expect(vm.price).toBe(149);
    expect(vm.soldOut).toBe(false);
  });
  it("falls back to basePrice and flags sold out", () => {
    const dep = { id: "d2", startDate: "2027-06-01", endDate: "2027-06-02", priceOverride: null, seatsTotal: 5, seatsBooked: 5, status: "OPEN" } as Departure;
    const vm = toDepartureModel(dep, tour, "en");
    expect(vm.price).toBe(199);
    expect(vm.seatsLeft).toBe(0);
    expect(vm.soldOut).toBe(true);
  });
});

describe("toReviewModel", () => {
  it("maps rating, author fallback and body", () => {
    const r = { id: "r1", rating: 5, title: "Great", body: "Loved it", createdAt: "2026-01-02T00:00:00Z", userFullName: null } as PublicReview;
    const vm = toReviewModel(r, "en");
    expect(vm.rating).toBe(5);
    expect(vm.author).toBe("Anonymous");
    expect(vm.title).toBe("Great");
  });
});
```

- [ ] **Step 2: Run, verify fail.** Run: `pnpm --filter @tourism/web test src/features/tour-detail/detail-view-model.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `apps/web/src/features/tour-detail/detail-view-model.ts`:
```ts
import type { TourDetail, Departure, PublicReview } from "@/lib/api/tours";

const LOCALE_TAG: Record<string, string> = { en: "en-US", vi: "vi-VN" };
const isVi = (locale: string) => locale === "vi";

function heroUrl(media: TourDetail["media"]): string | undefined {
  return media.find((m) => m.role === "hero")?.url ?? media[0]?.url;
}

export interface ItineraryVM {
  day: number;
  title: string;
  description?: string;
}
export interface TourDetailVM {
  slug: string;
  title: string;
  summary?: string;
  heroImage?: string;
  gallery: string[];
  rating?: number;
  reviewCount: number;
  price: number;
  currency: string;
  durationDays: number;
  maxGroupSize: number;
  category: string;
  meetingPoint?: string;
  included: string[];
  excluded: string[];
  localeTag: string;
  destination: { name: string; region?: string; country: string; description?: string };
  itinerary: ItineraryVM[];
}

export function toTourDetailModel(tour: TourDetail, locale: string): TourDetailVM {
  const vi = isVi(locale);
  return {
    slug: tour.slug,
    title: vi ? tour.titleVi : tour.titleEn,
    summary: (vi ? tour.summaryVi : tour.summaryEn) ?? undefined,
    heroImage: heroUrl(tour.media),
    gallery: tour.media.map((m) => m.url),
    rating: tour.averageRating ?? undefined,
    reviewCount: tour.reviewsCount,
    price: Number(tour.basePrice),
    currency: tour.currency,
    durationDays: tour.durationDays,
    maxGroupSize: tour.maxGroupSize,
    category: tour.category,
    meetingPoint: tour.meetingPoint ?? undefined,
    included: tour.included,
    excluded: tour.excluded,
    localeTag: LOCALE_TAG[locale] ?? "en-US",
    destination: {
      name: vi ? tour.destination.nameVi : tour.destination.nameEn,
      region: tour.destination.region ?? undefined,
      country: tour.destination.country,
      description: (vi ? tour.destination.descriptionVi : tour.destination.descriptionEn) ?? undefined,
    },
    itinerary: [...tour.itinerary]
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((d) => ({
        day: d.dayNumber,
        title: vi ? d.titleVi : d.titleEn,
        description: (vi ? d.descriptionVi : d.descriptionEn) ?? undefined,
      })),
  };
}

export interface DepartureVM {
  id: string;
  startDate: string;
  endDate: string;
  seatsLeft: number;
  soldOut: boolean;
  price: number;
}

export function toDepartureModel(dep: Departure, tour: TourDetail, _locale: string): DepartureVM {
  const seatsLeft = dep.seatsTotal - dep.seatsBooked;
  return {
    id: dep.id,
    startDate: dep.startDate,
    endDate: dep.endDate,
    seatsLeft,
    soldOut: seatsLeft <= 0,
    price: Number(dep.priceOverride ?? tour.basePrice),
  };
}

export interface ReviewVM {
  id: string;
  rating: number;
  title?: string;
  body: string;
  author: string;
  date: string;
}

export function toReviewModel(r: PublicReview, _locale: string): ReviewVM {
  return {
    id: r.id,
    rating: r.rating,
    title: r.title ?? undefined,
    body: r.body,
    author: r.userFullName ?? "Anonymous",
    date: r.createdAt,
  };
}
```

> If a DTO field name differs from the generated type, adjust the access; keep the VM interfaces + function names stable (later tasks import them).

- [ ] **Step 4: Run, verify pass** → PASS (5).

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/features/tour-detail/detail-view-model.ts apps/web/src/features/tour-detail/detail-view-model.test.ts
git commit -m "feat(web): tour detail view-model (localized props, seats, price)"
```

---

## Task 3: Tested sections — tour-reviews, tour-plan, booking-sidebar

**Files:** Create `tour-reviews.tsx`/`tour-reviews.test.tsx`, `tour-plan.tsx`/`tour-plan.test.tsx`, `booking-sidebar.tsx`/`booking-sidebar.test.tsx` under `apps/web/src/features/tour-detail/`.

These three consume the view-model and have render + empty-state logic, so each is TDD. They receive already-mapped VMs + label strings (parent maps via the view-model + i18n), keeping them pure/server components.

- [ ] **Step 1: Write `tour-reviews.test.tsx`**:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TourReviews } from "./tour-reviews";
import type { ReviewVM } from "./detail-view-model";

const reviews: ReviewVM[] = [
  { id: "r1", rating: 5, title: "Great", body: "Loved it", author: "Jane", date: "2026-01-02T00:00:00Z" },
];

describe("TourReviews", () => {
  it("renders a review per item with author and body", () => {
    render(<TourReviews reviews={reviews} averageRating={4.6} reviewCount={1} text={{ title: "Reviews", empty: "No reviews yet", average: "avg" }} localeTag="en-US" />);
    expect(screen.getByText("Loved it")).toBeInTheDocument();
    expect(screen.getByText("Jane")).toBeInTheDocument();
  });
  it("renders empty state when there are no reviews", () => {
    render(<TourReviews reviews={[]} averageRating={null} reviewCount={0} text={{ title: "Reviews", empty: "No reviews yet", average: "avg" }} localeTag="en-US" />);
    expect(screen.getByText("No reviews yet")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement `tour-reviews.tsx`**:
```tsx
import { StarIcon } from "lucide-react";
import type { ReviewVM } from "./detail-view-model";

interface Text { title: string; empty: string; average: string; }

export function TourReviews({
  reviews, averageRating, reviewCount, text, localeTag,
}: {
  reviews: ReviewVM[];
  averageRating: number | null;
  reviewCount: number;
  text: Text;
  localeTag: string;
}) {
  return (
    <section id="reviews" className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-6 flex items-baseline gap-3">
        <h2 className="font-heading text-2xl font-semibold">{text.title}</h2>
        {averageRating !== null && (
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            <StarIcon className="size-4 fill-current" /> {averageRating.toFixed(1)} · {reviewCount}
          </span>
        )}
      </div>
      {reviews.length === 0 ? (
        <p className="text-muted-foreground py-8">{text.empty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {reviews.map((r) => (
            <li key={r.id} className="border-border rounded-2xl border p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{r.author}</span>
                <span className="flex items-center gap-0.5 text-sm">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <StarIcon key={i} className="size-3.5 fill-current" />
                  ))}
                </span>
              </div>
              {r.title && <p className="font-medium">{r.title}</p>}
              <p className="text-muted-foreground text-sm">{r.body}</p>
              <time className="text-muted-foreground mt-2 block text-xs">
                {new Intl.DateTimeFormat(localeTag, { dateStyle: "medium" }).format(new Date(r.date))}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```
> Confirm `@tourism/ui/components/custom/rating` — if it cleanly renders a 1–5 star value, use it instead of the inline `StarIcon` loops (keep `TourReviews` props stable).

- [ ] **Step 4: Run, verify pass** (2).

- [ ] **Step 5: Write `tour-plan.test.tsx`**:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TourPlan } from "./tour-plan";
import type { ItineraryVM } from "./detail-view-model";

const days: ItineraryVM[] = [
  { day: 1, title: "Arrival", description: "Board the boat" },
  { day: 2, title: "Return", description: undefined },
];

describe("TourPlan", () => {
  it("renders one row per itinerary day", () => {
    render(<TourPlan days={days} title="Tour Plan" emptyLabel="No itinerary" />);
    expect(screen.getByText("Arrival")).toBeInTheDocument();
    expect(screen.getByText("Return")).toBeInTheDocument();
  });
  it("renders empty state when there are no days", () => {
    render(<TourPlan days={[]} title="Tour Plan" emptyLabel="No itinerary" />);
    expect(screen.getByText("No itinerary")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Implement `tour-plan.tsx`**:
```tsx
import type { ItineraryVM } from "./detail-view-model";

export function TourPlan({ days, title, emptyLabel }: { days: ItineraryVM[]; title: string; emptyLabel: string }) {
  return (
    <section id="plan" className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="font-heading mb-6 text-2xl font-semibold">{title}</h2>
      {days.length === 0 ? (
        <p className="text-muted-foreground py-8">{emptyLabel}</p>
      ) : (
        <ol className="border-border ml-3 border-l">
          {days.map((d) => (
            <li key={d.day} className="relative pb-8 pl-6 last:pb-0">
              <span className="bg-foreground text-background absolute -left-3 flex size-6 items-center justify-center rounded-full text-xs">
                {d.day}
              </span>
              <h3 className="font-medium">{d.title}</h3>
              {d.description && <p className="text-muted-foreground text-sm">{d.description}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Run, verify pass** (2).

- [ ] **Step 8: Write `booking-sidebar.test.tsx`**:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookingSidebar } from "./booking-sidebar";
import type { DepartureVM } from "./detail-view-model";

const deps: DepartureVM[] = [
  { id: "d1", startDate: "2027-06-01", endDate: "2027-06-02", seatsLeft: 3, soldOut: false, price: 149 },
];

const text = { title: "Book This Tour", bookNow: "Book now", seatsLeft: (n: number) => `${n} seats left`, empty: "No upcoming departures", from: "from" };

describe("BookingSidebar", () => {
  it("renders a row per departure with seats left and price", () => {
    render(<BookingSidebar departures={deps} currency="USD" localeTag="en-US" text={text} />);
    expect(screen.getByText("3 seats left")).toBeInTheDocument();
  });
  it("renders empty state when there are no departures", () => {
    render(<BookingSidebar departures={[]} currency="USD" localeTag="en-US" text={text} />);
    expect(screen.getByText("No upcoming departures")).toBeInTheDocument();
  });
  it("disables the Book Now CTA (booking is phase D)", () => {
    render(<BookingSidebar departures={deps} currency="USD" localeTag="en-US" text={text} />);
    expect(screen.getByRole("button", { name: "Book now" })).toBeDisabled();
  });
});
```

- [ ] **Step 9: Implement `booking-sidebar.tsx`**:
```tsx
import type { DepartureVM } from "./detail-view-model";

interface Text {
  title: string;
  bookNow: string;
  seatsLeft: (n: number) => string;
  empty: string;
  from: string;
}

export function BookingSidebar({
  departures, currency, localeTag, text,
}: {
  departures: DepartureVM[];
  currency: string;
  localeTag: string;
  text: Text;
}) {
  const money = (n: number) =>
    new Intl.NumberFormat(localeTag, { style: "currency", currency }).format(n);
  const day = (d: string) =>
    new Intl.DateTimeFormat(localeTag, { dateStyle: "medium" }).format(new Date(d));

  return (
    <aside className="border-border bg-muted/30 sticky top-20 rounded-2xl border p-6">
      <h2 className="font-heading mb-4 text-xl font-semibold">{text.title}</h2>
      {departures.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm">{text.empty}</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-3">
          {departures.map((d) => (
            <li key={d.id} className="border-border flex items-center justify-between rounded-xl border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{day(d.startDate)} → {day(d.endDate)}</p>
                <p className="text-muted-foreground text-xs">{text.seatsLeft(d.seatsLeft)}</p>
              </div>
              <span className="text-sm font-semibold">{money(d.price)}</span>
            </li>
          ))}
        </ul>
      )}
      {/* Booking flow is phase D — CTA is intentionally disabled for now. */}
      <button
        type="button"
        disabled
        className="bg-foreground text-background w-full cursor-not-allowed rounded-md py-2.5 text-sm font-medium opacity-60"
      >
        {text.bookNow}
      </button>
    </aside>
  );
}
```

- [ ] **Step 10: Run, verify pass** (3). Then typecheck.

- [ ] **Step 11: Commit**
```bash
git add apps/web/src/features/tour-detail/tour-reviews.tsx apps/web/src/features/tour-detail/tour-reviews.test.tsx apps/web/src/features/tour-detail/tour-plan.tsx apps/web/src/features/tour-detail/tour-plan.test.tsx apps/web/src/features/tour-detail/booking-sidebar.tsx apps/web/src/features/tour-detail/booking-sidebar.test.tsx
git commit -m "feat(web): tour detail sections — reviews, plan, booking sidebar (stub CTA)"
```

---

## Task 4: Presentational sections — hero, info, location, gallery, tab-nav

**Files:** Create `detail-hero.tsx`, `tour-info.tsx`, `tour-location.tsx`, `tour-gallery.tsx`, `detail-tab-nav.tsx` under `apps/web/src/features/tour-detail/`. Verified by typecheck + Task 6 manual check.

- [ ] **Step 1: `detail-hero.tsx`**:
```tsx
import Image from "next/image";

export function DetailHero({ image, eyebrow, title }: { image?: string; eyebrow: string; title: string }) {
  return (
    <section className="relative isolate flex min-h-[42vh] items-center justify-center overflow-hidden">
      {image && <Image src={image} alt="" fill priority className="-z-10 object-cover" sizes="100vw" />}
      <div className="absolute inset-0 -z-10 bg-black/35" />
      <div className="px-4 text-center text-white">
        <span className="text-sm tracking-[0.3em] uppercase opacity-90">{eyebrow}</span>
        <h1 className="font-heading mt-2 text-4xl font-semibold sm:text-6xl">{title}</h1>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `tour-info.tsx`** (key-value list + chips). Receives the `TourDetailVM` and a `labels` object:
```tsx
import { StarIcon } from "lucide-react";
import { Badge } from "@tourism/ui/components/custom/badge-custom";
import type { TourDetailVM } from "./detail-view-model";

interface Labels {
  title: string;
  destination: string; duration: string; groupSize: string; category: string; meetingPoint: string;
  included: string; excluded: string;
  days: (n: number) => string; people: (n: number) => string;
}

export function TourInfo({ tour, labels }: { tour: TourDetailVM; labels: Labels }) {
  const rows: [string, string][] = [
    [labels.destination, [tour.destination.name, tour.destination.region, tour.destination.country].filter(Boolean).join(", ")],
    [labels.duration, labels.days(tour.durationDays)],
    [labels.groupSize, labels.people(tour.maxGroupSize)],
    [labels.category, tour.category],
    ...(tour.meetingPoint ? ([[labels.meetingPoint, tour.meetingPoint]] as [string, string][]) : []),
  ];
  return (
    <section id="information" className="flex-1">
      <h2 className="font-heading text-3xl font-semibold tracking-tight">{labels.title}</h2>
      {tour.rating !== undefined && (
        <p className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
          <StarIcon className="size-4 fill-current" /> {tour.rating.toFixed(1)} · {tour.reviewCount}
        </p>
      )}
      {tour.summary && <p className="text-muted-foreground mt-4 max-w-prose">{tour.summary}</p>}
      <dl className="mt-6 grid grid-cols-1 gap-y-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">{k}</dt>
            <dd className="text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {tour.included.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">{labels.included}</p>
          <div className="flex flex-wrap gap-2">
            {tour.included.map((i) => <Badge key={i} variant="secondary">{i}</Badge>)}
          </div>
        </div>
      )}
      {tour.excluded.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">{labels.excluded}</p>
          <div className="flex flex-wrap gap-2">
            {tour.excluded.map((i) => <Badge key={i} variant="outline">{i}</Badge>)}
          </div>
        </div>
      )}
    </section>
  );
}
```
> Confirm `Badge` import path + `variant` values against `packages/ui/src/components/custom/badge-custom.tsx`; adapt variants if names differ.

- [ ] **Step 3: `tour-location.tsx`**:
```tsx
import { MapPinIcon } from "lucide-react";
import type { TourDetailVM } from "./detail-view-model";

export function TourLocation({ tour, title, meetingLabel }: { tour: TourDetailVM; title: string; meetingLabel: string }) {
  return (
    <section id="location" className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="font-heading mb-6 text-2xl font-semibold">{title}</h2>
      <div className="border-border flex items-start gap-3 rounded-2xl border p-6">
        <MapPinIcon className="text-muted-foreground mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-medium">
            {[tour.destination.name, tour.destination.region, tour.destination.country].filter(Boolean).join(", ")}
          </p>
          {tour.meetingPoint && (
            <p className="text-muted-foreground mt-1 text-sm">{meetingLabel}: {tour.meetingPoint}</p>
          )}
          {tour.destination.description && (
            <p className="text-muted-foreground mt-2 max-w-prose text-sm">{tour.destination.description}</p>
          )}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: `tour-gallery.tsx`**:
```tsx
import Image from "next/image";

export function TourGallery({ images, title, emptyLabel }: { images: string[]; title: string; emptyLabel: string }) {
  return (
    <section id="gallery" className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="font-heading mb-6 text-2xl font-semibold">{title}</h2>
      {images.length === 0 ? (
        <p className="text-muted-foreground py-8">{emptyLabel}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((src, i) => (
            <div key={src + i} className="relative aspect-[4/3] overflow-hidden rounded-xl">
              <Image src={src} alt="" fill className="object-cover" sizes="(max-width: 640px) 50vw, 33vw" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: `detail-tab-nav.tsx`** (client, sticky anchor nav):
```tsx
"use client";

export function DetailTabNav({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav className="border-border bg-background/90 sticky top-16 z-30 border-y backdrop-blur">
      <div className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-4 py-3">
        {items.map((it) => (
          <a key={it.href} href={it.href} className="text-muted-foreground hover:text-foreground text-sm font-medium whitespace-nowrap">
            {it.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 6: Typecheck + commit**
```bash
pnpm --filter @tourism/web typecheck
git add apps/web/src/features/tour-detail/detail-hero.tsx apps/web/src/features/tour-detail/tour-info.tsx apps/web/src/features/tour-detail/tour-location.tsx apps/web/src/features/tour-detail/tour-gallery.tsx apps/web/src/features/tour-detail/detail-tab-nav.tsx
git commit -m "feat(web): tour detail presentational sections (hero, info, location, gallery, tab-nav)"
```

---

## Task 5: Compose + route + i18n

**Files:** Create `tour-detail.tsx`; `app/[locale]/tours/[slug]/page.tsx`; `app/[locale]/tours/[slug]/loading.tsx`. Modify `messages/en.json`, `vi.json`.

- [ ] **Step 1: Add `TourDetail` namespace to `apps/web/messages/en.json`** (merge):
```json
"TourDetail": {
  "eyebrow": "Explore",
  "infoTitle": "Information",
  "tabInformation": "Information",
  "tabPlan": "Tour Plan",
  "tabLocation": "Location",
  "tabGallery": "Gallery",
  "destination": "Destination",
  "duration": "Duration",
  "groupSize": "Group size",
  "category": "Category",
  "meetingPoint": "Meeting point",
  "included": "Included",
  "excluded": "Not included",
  "days": "{count} days",
  "people": "Up to {count} people",
  "bookTitle": "Book This Tour",
  "bookNow": "Book now",
  "departuresEmpty": "No upcoming departures.",
  "seatsLeft": "{count} seats left",
  "from": "from",
  "planTitle": "Tour Plan",
  "planEmpty": "Itinerary coming soon.",
  "locationTitle": "Location",
  "galleryTitle": "From our gallery",
  "galleryEmpty": "No photos yet.",
  "reviewsTitle": "Reviews",
  "reviewsEmpty": "No reviews yet.",
  "average": "average"
}
```

- [ ] **Step 2: Add the same namespace to `apps/web/messages/vi.json`** (merge):
```json
"TourDetail": {
  "eyebrow": "Khám phá",
  "infoTitle": "Thông tin",
  "tabInformation": "Thông tin",
  "tabPlan": "Lịch trình",
  "tabLocation": "Vị trí",
  "tabGallery": "Thư viện",
  "destination": "Điểm đến",
  "duration": "Thời lượng",
  "groupSize": "Quy mô nhóm",
  "category": "Loại tour",
  "meetingPoint": "Điểm tập trung",
  "included": "Bao gồm",
  "excluded": "Không bao gồm",
  "days": "{count} ngày",
  "people": "Tối đa {count} người",
  "bookTitle": "Đặt tour này",
  "bookNow": "Đặt ngay",
  "departuresEmpty": "Chưa có ngày khởi hành.",
  "seatsLeft": "Còn {count} chỗ",
  "from": "từ",
  "planTitle": "Lịch trình",
  "planEmpty": "Lịch trình sẽ sớm cập nhật.",
  "locationTitle": "Vị trí",
  "galleryTitle": "Thư viện ảnh",
  "galleryEmpty": "Chưa có ảnh.",
  "reviewsTitle": "Đánh giá",
  "reviewsEmpty": "Chưa có đánh giá.",
  "average": "trung bình"
}
```
Keep both JSON valid (no trailing commas); read each file first and insert as a new top-level key.

- [ ] **Step 3: Implement `apps/web/src/features/tour-detail/tour-detail.tsx`** (compose; receives mapped VMs + a `t` translator passed as a plain function-free `text` object built by the page):
```tsx
import type { TourDetailVM, DepartureVM, ReviewVM } from "./detail-view-model";
import { DetailHero } from "./detail-hero";
import { DetailTabNav } from "./detail-tab-nav";
import { TourInfo } from "./tour-info";
import { BookingSidebar } from "./booking-sidebar";
import { TourPlan } from "./tour-plan";
import { TourLocation } from "./tour-location";
import { TourGallery } from "./tour-gallery";
import { TourReviews } from "./tour-reviews";

export interface DetailText {
  eyebrow: string;
  tabs: { information: string; plan: string; location: string; gallery: string };
  info: {
    title: string; destination: string; duration: string; groupSize: string; category: string;
    meetingPoint: string; included: string; excluded: string;
    days: (n: number) => string; people: (n: number) => string;
  };
  booking: { title: string; bookNow: string; seatsLeft: (n: number) => string; empty: string; from: string };
  plan: { title: string; empty: string };
  location: { title: string; meetingLabel: string };
  gallery: { title: string; empty: string };
  reviews: { title: string; empty: string; average: string };
}

export function TourDetail({
  tour, departures, reviews, averageRating, text,
}: {
  tour: TourDetailVM;
  departures: DepartureVM[];
  reviews: ReviewVM[];
  averageRating: number | null;
  text: DetailText;
}) {
  return (
    <main className="flex flex-col">
      <DetailHero image={tour.heroImage} eyebrow={text.eyebrow} title={tour.title} />
      <DetailTabNav
        items={[
          { href: "#information", label: text.tabs.information },
          { href: "#plan", label: text.tabs.plan },
          { href: "#location", label: text.tabs.location },
          { href: "#gallery", label: text.tabs.gallery },
        ]}
      />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-12 lg:grid-cols-[1fr_340px]">
        <TourInfo tour={tour} labels={text.info} />
        <BookingSidebar departures={departures} currency={tour.currency} localeTag={tour.localeTag} text={text.booking} />
      </div>
      <TourPlan days={tour.itinerary} title={text.plan.title} emptyLabel={text.plan.empty} />
      <TourLocation tour={tour} title={text.location.title} meetingLabel={text.location.meetingLabel} />
      <TourGallery images={tour.gallery} title={text.gallery.title} emptyLabel={text.gallery.empty} />
      <TourReviews reviews={reviews} averageRating={averageRating} reviewCount={tour.reviewCount} text={text.reviews} localeTag={tour.localeTag} />
    </main>
  );
}
```

- [ ] **Step 4: Implement `app/[locale]/tours/[slug]/page.tsx`** (RSC, parallel fetch, notFound on 404):
```tsx
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getTour, getTourDepartures, getTourReviews } from "@/lib/api/tours";
import { ApiError } from "@/lib/api/errors";
import { toTourDetailModel, toDepartureModel, toReviewModel } from "@/features/tour-detail/detail-view-model";
import { TourDetail } from "@/features/tour-detail/tour-detail";

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function TourDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("TourDetail");

  let detail;
  try {
    detail = await getTour(slug);
  } catch (err) {
    if (ApiError.isApiError(err) && err.status === 404) notFound();
    throw err;
  }
  const [departuresRaw, reviewsRes] = await Promise.all([
    getTourDepartures(slug).catch(() => []),
    getTourReviews(slug).catch(() => ({ reviews: [], averageRating: null, meta: { page: 1, pageSize: 0, total: 0, totalPages: 0 } })),
  ]);

  const tour = toTourDetailModel(detail, locale);
  const departures = departuresRaw.map((d) => toDepartureModel(d, detail, locale));
  const reviews = reviewsRes.reviews.map((r) => toReviewModel(r, locale));

  return (
    <TourDetail
      tour={tour}
      departures={departures}
      reviews={reviews}
      averageRating={reviewsRes.averageRating}
      text={{
        eyebrow: t("eyebrow"),
        tabs: { information: t("tabInformation"), plan: t("tabPlan"), location: t("tabLocation"), gallery: t("tabGallery") },
        info: {
          title: t("infoTitle"), destination: t("destination"), duration: t("duration"), groupSize: t("groupSize"),
          category: t("category"), meetingPoint: t("meetingPoint"), included: t("included"), excluded: t("excluded"),
          days: (n) => t("days", { count: n }), people: (n) => t("people", { count: n }),
        },
        booking: { title: t("bookTitle"), bookNow: t("bookNow"), seatsLeft: (n) => t("seatsLeft", { count: n }), empty: t("departuresEmpty"), from: t("from") },
        plan: { title: t("planTitle"), empty: t("planEmpty") },
        location: { title: t("locationTitle"), meetingLabel: t("meetingPoint") },
        gallery: { title: t("galleryTitle"), empty: t("galleryEmpty") },
        reviews: { title: t("reviewsTitle"), empty: t("reviewsEmpty"), average: t("average") },
      }}
    />
  );
}
```
> `params` is a Promise in Next 16 — await it. Mirror the home/tours pages' next-intl import style.

- [ ] **Step 5: Implement `app/[locale]/tours/[slug]/loading.tsx`**:
```tsx
import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col">
      <ShimmerSkeleton aria-hidden="true" className="h-[42vh] w-full" />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-12 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          <ShimmerSkeleton aria-hidden="true" className="h-10 w-2/3 rounded-lg" />
          <ShimmerSkeleton aria-hidden="true" className="h-40 w-full rounded-xl" />
        </div>
        <ShimmerSkeleton aria-hidden="true" className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck, lint, full test run**
```bash
pnpm --filter @tourism/web typecheck
pnpm --filter @tourism/web lint
pnpm --filter @tourism/web test
node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/vi.json','utf8'));JSON.parse(require('fs').readFileSync('apps/web/messages/en.json','utf8'));console.log('json ok')"
```
Expected: clean/green.

- [ ] **Step 7: Commit**
```bash
git add "apps/web/src/app/[locale]/tours/[slug]" apps/web/src/features/tour-detail/tour-detail.tsx apps/web/messages/en.json apps/web/messages/vi.json
git commit -m "feat(web): tour detail compose + /tours/[slug] route + i18n"
```

---

## Task 6: Manual verification + DoD + merge

- [ ] **Step 1: Run backend + web** (two terminals): `pnpm --filter @tourism/api start:dev`, `pnpm --filter @tourism/web dev`. Open `http://localhost:3001/en/tours` and click a card.

- [ ] **Step 2: Verify**
- [ ] Detail page renders: hero (with image), tab-nav, information + key-value list, booking sidebar with **real departures** (date, seats left, price) and a **disabled** "Book now".
- [ ] Tour Plan shows itinerary rows; Location card shows destination + meeting point; Gallery shows **real Cloudinary images**; Reviews shows list or empty state with average rating.
- [ ] Tab-nav anchors jump to sections.
- [ ] `/vi/tours/<slug>` renders Vietnamese labels + VI title/itinerary + VND prices.
- [ ] `http://localhost:3001/en/tours/does-not-exist` → localized not-found (not a crash).
- [ ] No console errors.

- [ ] **Step 3: Update roadmap** — mark "Customer FE — B2 Package Detail" done in `docs/planning/roadmap.md`, linking this plan/spec. Commit:
```bash
git add docs/planning/roadmap.md
git commit -m "docs: mark customer FE B2 Package Detail complete"
```

- [ ] **Step 4: Integrate (rebase-and-merge, linear)** — confirm with the user before pushing master:
```bash
git checkout master
git merge --ff-only feat/customer-fe-browse-detail
git push origin master
git branch -d feat/customer-fe-browse-detail
```

---

## Self-review (author)

- **Spec coverage:** route + RSC parallel fetch + notFound (T5), helpers (T1), view-model (T2), reviews/plan/booking-sidebar with tests (T3), hero/info/location/gallery/tab-nav (T4), i18n + loading (T5), DoD (T6). Spec §1–10 covered.
- **Type consistency:** `TourDetail`/`Departure`/`PublicReview` defined in `tours.ts` (T1), consumed by view-model (T2); `TourDetailVM`/`DepartureVM`/`ReviewVM`/`ItineraryVM` defined in `detail-view-model.ts` (T2) and consumed by all section components + `tour-detail.tsx` (T3–T5). `text`/`labels` prop shapes match between section components and the page's construction.
- **Placeholder scan:** none; uncertain library APIs (`rating`, `Badge` variants, reviews `meta.averageRating` placement, generated schema names) flagged as verify-and-adjust `>` notes.
- **Reuse:** `ShimmerSkeleton`, `Badge`, (optional `rating`), `next/image`, existing `not-found.tsx`/`error.tsx`. Booking CTA deliberately disabled (phase D).
