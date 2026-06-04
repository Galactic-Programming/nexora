# Customer FE — B1 Packages Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the server-rendered `/[locale]/tours` packages archive (hero + sort toolbar + filter sidebar + card grid + pagination) reading state from the URL.

**Architecture:** RSC page parses URL search params → `listTours()` (preserves pagination `meta`) → renders grid (reusing `TourCard` + `toTourCardModel`) + pagination + sidebar. Client controls push merged search params via next-intl navigation; the server re-fetches. Tour card images are enabled by allowlisting Cloudinary in `next/image`.

**Tech Stack:** Next.js 16 App Router, next-intl, Tailwind v4, `@tourism/ui`, zod, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-06-04-customer-fe-browse-archive-design.md`
**Branch:** `feat/customer-fe-browse-archive` (already created).

---

## Conventions

- Run from repo root `c:/develop/Apps/Main-Projects/tourism-be-api`; app commands via `pnpm --filter @tourism/web ...`.
- `@/` → `apps/web/src/`. UI imports via package exports, e.g. `@tourism/ui/components/custom/tour-card`.
- Backend must be running for manual verification (Task 8): `pnpm --filter @tourism/api start:dev`. Unit tests do NOT need it.
- Locale-aware nav: `Link, useRouter, usePathname` from `@/i18n/navigation`. Read params with `useSearchParams` from `next/navigation` (reading is locale-agnostic).
- Reuse first (see spec §5). Confirm exact prop names against `packages/ui/src/components/...` before adapting.

## Known facts (verified)

- `next.config.ts` exists (TypeScript config).
- `@/i18n/navigation` exports `Link, redirect, usePathname, useRouter, getPathname` (NOT `useSearchParams`).
- `@tourism/ui/components/custom/pagination-control` exists; `tour-card` exports `TourCard` taking a `TourCardProps` view-model (the A helper `toTourCardModel` already returns it).
- A's `features/home/tour-view-model.ts` exports `ApiTour` (= `TourWithStatsDto`) and `toTourCardModel(tour, locale)`.
- Backend runtime list envelope: `{ data: ApiTour[], error, meta: { page, pageSize, total, totalPages } }`. Path key includes `/api/v1`; `env.NEXT_PUBLIC_API_BASE_URL` is the origin.

---

## File structure (created/modified)

```text
apps/web/
  next.config.ts                                   # MODIFY: images.remotePatterns (Cloudinary)
  messages/en.json, vi.json                        # MODIFY: ToursArchive namespace
  src/
    lib/api/tours.ts                               # CREATE: listTours + PaginationMeta
    lib/api/tours.test.ts                          # CREATE
    features/tours/tours-query.ts                  # CREATE: parse/serialize search params
    features/tours/tours-query.test.ts             # CREATE
    features/tours/tour-grid.tsx                    # CREATE
    features/tours/tour-grid.test.tsx              # CREATE
    features/tours/tour-sort-bar.tsx               # CREATE (client)
    features/tours/tour-filter-sidebar.tsx         # CREATE (client)
    features/tours/tours-pagination.tsx            # CREATE (client)
    features/tours/tour-hero.tsx                   # CREATE
    features/tours/tours-archive.tsx               # CREATE (compose)
    app/[locale]/tours/page.tsx                    # CREATE (RSC)
    app/[locale]/tours/loading.tsx                 # CREATE
```

---

## Task 1: `listTours` API helper (preserves `meta`)

**Files:** Create `apps/web/src/lib/api/tours.ts`, `apps/web/src/lib/api/tours.test.ts`.

- [ ] **Step 1: Write the failing test** — `apps/web/src/lib/api/tours.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { listTours } from "./tours";
import { ApiError } from "./errors";

afterEach(() => vi.restoreAllMocks());

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

const tour = { slug: "a", titleEn: "A", media: [] };

describe("listTours", () => {
  it("returns tours + meta from the envelope", async () => {
    mockFetch({ data: [tour], error: null, meta: { page: 1, pageSize: 9, total: 1, totalPages: 1 } });
    const res = await listTours({ page: 1, pageSize: 9, sortBy: "createdAt", sortOrder: "desc" });
    expect(res.tours).toHaveLength(1);
    expect(res.meta).toEqual({ page: 1, pageSize: 9, total: 1, totalPages: 1 });
  });

  it("sends only defined query params", async () => {
    const spy = vi.fn(async () =>
      new Response(JSON.stringify({ data: [], error: null, meta: { page: 1, pageSize: 9, total: 0, totalPages: 0 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", spy);
    await listTours({ page: 2, pageSize: 9, q: "lantern", sortBy: "basePrice", sortOrder: "asc" });
    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain("/api/v1/tours?");
    expect(url).toContain("page=2");
    expect(url).toContain("q=lantern");
    expect(url).toContain("sortBy=basePrice");
    expect(url).not.toContain("minPrice");
  });

  it("throws ApiError when the envelope carries an error", async () => {
    mockFetch({ data: null, error: { code: "BAD", message: "nope" } }, 400);
    await expect(listTours({ page: 1, pageSize: 9, sortBy: "createdAt", sortOrder: "desc" })).rejects.toMatchObject({
      name: "ApiError",
      code: "BAD",
      status: 400,
    });
    await expect(listTours({ page: 1, pageSize: 9, sortBy: "createdAt", sortOrder: "desc" })).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter @tourism/web test src/lib/api/tours.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** `apps/web/src/lib/api/tours.ts`:
```ts
import { env } from "../env";
import { ApiError } from "./errors";
import type { ApiTour } from "@/features/home/tour-view-model";

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ToursQueryInput {
  page: number;
  pageSize: number;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy: "createdAt" | "basePrice" | "durationDays" | "titleEn";
  sortOrder: "asc" | "desc";
}

type ListEnvelope = {
  data: ApiTour[] | null;
  error: { code: string; message: string } | null;
  meta?: PaginationMeta;
};

/** Lists published tours, preserving pagination meta (the openapi-fetch
 * middleware in client.ts drops meta, so this helper reads the raw envelope). */
export async function listTours(
  query: ToursQueryInput,
): Promise<{ tours: ApiTour[]; meta: PaginationMeta }> {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  params.set("sortBy", query.sortBy);
  params.set("sortOrder", query.sortOrder);
  if (query.q) params.set("q", query.q);
  if (query.minPrice !== undefined) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) params.set("maxPrice", String(query.maxPrice));

  const url = `${env.NEXT_PUBLIC_API_BASE_URL}/api/v1/tours?${params.toString()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const body = (await res.json()) as ListEnvelope;
  if (body.error) {
    throw new ApiError(body.error.code, body.error.message, res.status);
  }
  return {
    tours: body.data ?? [],
    meta: body.meta ?? { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 },
  };
}
```

- [ ] **Step 4: Run, verify pass** — `pnpm --filter @tourism/web test src/lib/api/tours.test.ts` → PASS (3).

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/lib/api/tours.ts apps/web/src/lib/api/tours.test.ts
git commit -m "feat(web): listTours API helper preserving pagination meta"
```

---

## Task 2: `tours-query` — parse/serialize URL search params

**Files:** Create `apps/web/src/features/tours/tours-query.ts`, `apps/web/src/features/tours/tours-query.test.ts`.

- [ ] **Step 1: Write the failing test** — `tours-query.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseToursQuery, serializeToursQuery, PAGE_SIZE } from "./tours-query";

describe("parseToursQuery", () => {
  it("applies defaults for empty params", () => {
    expect(parseToursQuery({})).toEqual({
      page: 1, pageSize: PAGE_SIZE, sortBy: "createdAt", sortOrder: "desc",
    });
  });

  it("reads valid filters and coerces numbers", () => {
    const q = parseToursQuery({ page: "2", q: "lantern", minPrice: "30", maxPrice: "200", sortBy: "basePrice", sortOrder: "asc" });
    expect(q).toMatchObject({ page: 2, q: "lantern", minPrice: 30, maxPrice: 200, sortBy: "basePrice", sortOrder: "asc" });
  });

  it("falls back to defaults on invalid values", () => {
    const q = parseToursQuery({ page: "-3", sortBy: "evil", sortOrder: "sideways" });
    expect(q.page).toBe(1);
    expect(q.sortBy).toBe("createdAt");
    expect(q.sortOrder).toBe("desc");
  });

  it("takes the first value when a param repeats", () => {
    expect(parseToursQuery({ q: ["a", "b"] }).q).toBe("a");
  });
});

describe("serializeToursQuery", () => {
  it("omits defaults and undefined", () => {
    const sp = serializeToursQuery({ page: 1, pageSize: PAGE_SIZE, sortBy: "createdAt", sortOrder: "desc" });
    expect(sp.toString()).toBe("");
  });

  it("includes non-default values", () => {
    const sp = serializeToursQuery({ page: 2, pageSize: PAGE_SIZE, q: "x", minPrice: 30, sortBy: "basePrice", sortOrder: "asc" });
    expect(sp.get("page")).toBe("2");
    expect(sp.get("q")).toBe("x");
    expect(sp.get("minPrice")).toBe("30");
    expect(sp.get("sortBy")).toBe("basePrice");
    expect(sp.get("sortOrder")).toBe("asc");
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter @tourism/web test src/features/tours/tours-query.test.ts` → FAIL.

- [ ] **Step 3: Implement** `apps/web/src/features/tours/tours-query.ts`:
```ts
import { z } from "zod";
import type { ToursQueryInput } from "@/lib/api/tours";

export const PAGE_SIZE = 9;
export const SORT_BY = ["createdAt", "basePrice", "durationDays", "titleEn"] as const;
export type SortBy = (typeof SORT_BY)[number];
export type SortOrder = "asc" | "desc";
export type ToursQuery = ToursQueryInput;

type RawParams = Record<string, string | string[] | undefined>;

const schema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  q: z.string().trim().min(1).max(80).optional().catch(undefined),
  minPrice: z.coerce.number().min(0).optional().catch(undefined),
  maxPrice: z.coerce.number().min(0).optional().catch(undefined),
  sortBy: z.enum(SORT_BY).catch("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).catch("desc"),
});

/** Parse Next.js searchParams (string | string[] | undefined) into a typed query. */
export function parseToursQuery(sp: RawParams): ToursQuery {
  const flat = Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const parsed = schema.parse(flat);
  return { ...parsed, pageSize: PAGE_SIZE };
}

/** Serialize a query back to URLSearchParams, omitting defaults/empty. */
export function serializeToursQuery(q: Partial<ToursQuery>): URLSearchParams {
  const sp = new URLSearchParams();
  if (q.page && q.page > 1) sp.set("page", String(q.page));
  if (q.q) sp.set("q", q.q);
  if (q.minPrice !== undefined) sp.set("minPrice", String(q.minPrice));
  if (q.maxPrice !== undefined) sp.set("maxPrice", String(q.maxPrice));
  if (q.sortBy && q.sortBy !== "createdAt") sp.set("sortBy", q.sortBy);
  if (q.sortOrder && q.sortOrder !== "desc") sp.set("sortOrder", q.sortOrder);
  return sp;
}
```

> Note (zod v4): `.catch(...)` provides the fallback when parsing fails; `.optional().catch(undefined)` yields `undefined` for missing/invalid. If the installed zod rejects `z.coerce`, use `z.preprocess((v) => v == null ? v : Number(v), z.number()...)` — keep the same return shape and tests green.

- [ ] **Step 4: Run, verify pass** — PASS (6).

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/features/tours/tours-query.ts apps/web/src/features/tours/tours-query.test.ts
git commit -m "feat(web): tours archive URL query parse/serialize"
```

---

## Task 3: Enable Cloudinary images in `next/image`

**Files:** Modify `apps/web/next.config.ts`.

- [ ] **Step 1: Read the current config** — `cat apps/web/next.config.ts`. It likely wraps config with the next-intl plugin. Preserve that wrapper.

- [ ] **Step 2: Add `images.remotePatterns`** for Cloudinary. Merge into the existing `nextConfig` object (do not drop the next-intl plugin wrapper):
```ts
const nextConfig: NextConfig = {
  // ...existing options...
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};
```

- [ ] **Step 3: Typecheck** — `pnpm --filter @tourism/web typecheck` → clean.

- [ ] **Step 4: Commit**
```bash
git add apps/web/next.config.ts
git commit -m "feat(web): allow Cloudinary images in next/image (fixes tour card images)"
```

> Why: A shipped cards with no images (`img_count=0`) because `next/image` blocks un-allowlisted remote hosts. Tour media URLs are `https://res.cloudinary.com/...`. This unblocks `TourCard` images app-wide.

---

## Task 4: `tour-grid` — cards + empty state

**Files:** Create `apps/web/src/features/tours/tour-grid.tsx`, `apps/web/src/features/tours/tour-grid.test.tsx`.

- [ ] **Step 1: Write the failing test** — `tour-grid.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TourGrid } from "./tour-grid";
import type { ApiTour } from "@/features/home/tour-view-model";

const tour = {
  slug: "alpha", titleEn: "Alpha Tour", titleVi: "Alpha VI",
  summaryEn: "s", summaryVi: "s", basePrice: "100.00", currency: "USD",
  durationDays: 2, category: "DAY", isFeatured: false,
  averageRating: 4.2, reviewsCount: 3,
  media: [{ url: "https://res.cloudinary.com/x/a.jpg", role: "hero", type: "IMAGE", sortOrder: 0 }],
} as ApiTour;

describe("TourGrid", () => {
  it("renders a card per tour", () => {
    render(<TourGrid tours={[tour]} locale="en" emptyLabel="None" />);
    expect(screen.getByText("Alpha Tour")).toBeInTheDocument();
  });

  it("renders the empty label when there are no tours", () => {
    render(<TourGrid tours={[]} locale="en" emptyLabel="No tours match" />);
    expect(screen.getByText("No tours match")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail** — FAIL (module not found).

- [ ] **Step 3: Implement** `apps/web/src/features/tours/tour-grid.tsx`:
```tsx
import { TourCard } from "@tourism/ui/components/custom/tour-card";
import { toTourCardModel, type ApiTour } from "@/features/home/tour-view-model";

interface TourGridProps {
  tours: ApiTour[];
  locale: string;
  emptyLabel: string;
}

export function TourGrid({ tours, locale, emptyLabel }: TourGridProps) {
  if (tours.length === 0) {
    return <p className="text-muted-foreground py-16 text-center">{emptyLabel}</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {tours.map((tour) => (
        <TourCard key={tour.slug} className="max-w-none" {...toTourCardModel(tour, locale)} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass** — PASS (2).

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/features/tours/tour-grid.tsx apps/web/src/features/tours/tour-grid.test.tsx
git commit -m "feat(web): tour grid (reuses TourCard) with empty state"
```

---

## Task 5: Client controls — sort bar, filter sidebar, pagination

**Files:** Create `tour-sort-bar.tsx`, `tour-filter-sidebar.tsx`, `tours-pagination.tsx` under `apps/web/src/features/tours/`.

> These are client components that build the next URL via `serializeToursQuery` (Task 2) and push it with next-intl `useRouter`. URL-building correctness is covered by the Task 2 serialization tests; these components are verified by typecheck + Task 8 manual check (jsdom tests of router pushes add little signal).

- [ ] **Step 1: Implement `tour-sort-bar.tsx`**:
```tsx
"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { serializeToursQuery, parseToursQuery, type SortBy, type SortOrder } from "./tours-query";

type Option = { label: string; sortBy: SortBy; sortOrder: SortOrder };

export function TourSortBar({ options }: { options: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = parseToursQuery(Object.fromEntries(sp.entries()));

  function select(o: Option) {
    const next = serializeToursQuery({ ...current, page: 1, sortBy: o.sortBy, sortOrder: o.sortOrder });
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = current.sortBy === o.sortBy && current.sortOrder === o.sortOrder;
        return (
          <button
            key={o.label}
            type="button"
            onClick={() => select(o)}
            aria-pressed={active}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${active ? "bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Implement `tour-filter-sidebar.tsx`** (search debounced + price apply/clear):
```tsx
"use client";

import { useState } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Button } from "@tourism/ui/components/custom/button-custom";
import { serializeToursQuery, parseToursQuery } from "./tours-query";

interface Labels {
  title: string;
  searchPlaceholder: string;
  minPrice: string;
  maxPrice: string;
  apply: string;
  clear: string;
}

export function TourFilterSidebar({ labels }: { labels: Labels }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = parseToursQuery(Object.fromEntries(sp.entries()));

  const [q, setQ] = useState(current.q ?? "");
  const [min, setMin] = useState(current.minPrice?.toString() ?? "");
  const [max, setMax] = useState(current.maxPrice?.toString() ?? "");

  function apply() {
    const next = serializeToursQuery({
      ...current,
      page: 1,
      q: q.trim() || undefined,
      minPrice: min ? Number(min) : undefined,
      maxPrice: max ? Number(max) : undefined,
    });
    router.push(`${pathname}?${next.toString()}`);
  }
  function clear() {
    setQ(""); setMin(""); setMax("");
    const next = serializeToursQuery({ page: 1, pageSize: current.pageSize, sortBy: current.sortBy, sortOrder: current.sortOrder });
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <aside className="bg-muted/40 rounded-2xl p-6">
      <h2 className="font-heading mb-4 text-xl font-semibold">{labels.title}</h2>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        placeholder={labels.searchPlaceholder}
        className="border-border mb-3 w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      <div className="mb-4 flex gap-2">
        <input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} placeholder={labels.minPrice}
          className="border-border w-full rounded-md border bg-background px-3 py-2 text-sm" />
        <input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} placeholder={labels.maxPrice}
          className="border-border w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-2">
        <Button onClick={apply} className="flex-1">{labels.apply}</Button>
        <Button onClick={clear} variant="outline" className="flex-1">{labels.clear}</Button>
      </div>
    </aside>
  );
}
```

> Debounce note: pushing on Enter/Apply keeps B1 simple and avoids a debounce dependency. If you prefer live-search, wrap `setQ` in a `useEffect` + `setTimeout(400)` that calls `apply()`; either satisfies the spec. Confirm the legacy `Input` component name in `packages/ui/src/components/legacy/`; if present and ergonomic, swap the raw `<input>` for it.

- [ ] **Step 3: Implement `tours-pagination.tsx`** (reuse the custom control if its API fits; otherwise prev/next + page label):
```tsx
"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { serializeToursQuery, parseToursQuery } from "./tours-query";

interface Props { totalPages: number; ariaLabel: string; }

export function ToursPagination({ totalPages, ariaLabel }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = parseToursQuery(Object.fromEntries(sp.entries()));
  if (totalPages <= 1) return null;

  function go(page: number) {
    const next = serializeToursQuery({ ...current, page });
    router.push(`${pathname}?${next.toString()}`);
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <nav aria-label={ariaLabel} className="mt-10 flex justify-center gap-2">
      {pages.map((p) => (
        <button key={p} type="button" onClick={() => go(p)} aria-current={p === current.page ? "page" : undefined}
          className={`size-9 rounded-md border text-sm ${p === current.page ? "bg-foreground text-background" : "border-border hover:bg-muted"}`}>
          {p}
        </button>
      ))}
    </nav>
  );
}
```

> Check `@tourism/ui/components/custom/pagination-control` first — if it accepts `(currentPage, totalPages, onPageChange)` or an `href` builder, prefer it over this hand-rolled nav and delete the local version. Keep the `ToursPagination` wrapper name + props so `tours-archive` is unaffected.

- [ ] **Step 4: Typecheck** — `pnpm --filter @tourism/web typecheck` → clean (fix import/name mismatches per the `>` notes).

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/features/tours/tour-sort-bar.tsx apps/web/src/features/tours/tour-filter-sidebar.tsx apps/web/src/features/tours/tours-pagination.tsx
git commit -m "feat(web): tours archive client controls (sort, filter sidebar, pagination)"
```

---

## Task 6: `tour-hero` + `tours-archive` shell

**Files:** Create `apps/web/src/features/tours/tour-hero.tsx`, `apps/web/src/features/tours/tours-archive.tsx`.

> Presentational composition; verified by typecheck + Task 8.

- [ ] **Step 1: Implement `tour-hero.tsx`**:
```tsx
interface TourHeroProps { eyebrow: string; title: string; }

export function TourHero({ eyebrow, title }: TourHeroProps) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-muted px-6 py-20 text-center sm:py-28">
      <span className="text-muted-foreground text-sm tracking-[0.3em] uppercase">{eyebrow}</span>
      <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">{title}</h1>
    </section>
  );
}
```

> If a Shadcn Studio hero block in `packages/ui/src/components/shadcn-studio` fits a banner-with-image better, use it and pass these props through. A background image can be added in the polish pass.

- [ ] **Step 2: Implement `tours-archive.tsx`** (compose hero + toolbar + grid/sidebar + pagination):
```tsx
import type { ApiTour } from "@/features/home/tour-view-model";
import type { PaginationMeta } from "@/lib/api/tours";
import type { SortBy, SortOrder } from "./tours-query";
import { TourHero } from "./tour-hero";
import { TourSortBar } from "./tour-sort-bar";
import { TourFilterSidebar } from "./tour-filter-sidebar";
import { TourGrid } from "./tour-grid";
import { ToursPagination } from "./tours-pagination";

interface ArchiveText {
  eyebrow: string; title: string;
  resultsCount: (n: number) => string;
  emptyLabel: string;
  sort: { date: string; priceAsc: string; priceDesc: string; name: string };
  filter: { title: string; searchPlaceholder: string; minPrice: string; maxPrice: string; apply: string; clear: string };
  paginationAria: string;
}

interface Props {
  tours: ApiTour[];
  meta: PaginationMeta;
  locale: string;
  text: ArchiveText;
}

export function ToursArchive({ tours, meta, locale, text }: Props) {
  const sortOptions: { label: string; sortBy: SortBy; sortOrder: SortOrder }[] = [
    { label: text.sort.date, sortBy: "createdAt", sortOrder: "desc" },
    { label: text.sort.priceAsc, sortBy: "basePrice", sortOrder: "asc" },
    { label: text.sort.priceDesc, sortBy: "basePrice", sortOrder: "desc" },
    { label: text.sort.name, sortBy: "titleEn", sortOrder: "asc" },
  ];
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <TourHero eyebrow={text.eyebrow} title={text.title} />
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">{text.resultsCount(meta.total)}</p>
        <TourSortBar options={sortOptions} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <TourGrid tours={tours} locale={locale} emptyLabel={text.emptyLabel} />
          <ToursPagination totalPages={meta.totalPages} ariaLabel={text.paginationAria} />
        </div>
        <TourFilterSidebar labels={text.filter} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck** — clean.

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/features/tours/tour-hero.tsx apps/web/src/features/tours/tours-archive.tsx
git commit -m "feat(web): tours archive shell (hero + toolbar + grid/sidebar + pagination)"
```

---

## Task 7: Route page + loading + i18n messages

**Files:** Create `apps/web/src/app/[locale]/tours/page.tsx`, `apps/web/src/app/[locale]/tours/loading.tsx`. Modify `apps/web/messages/en.json`, `vi.json`.

- [ ] **Step 1: Add the `ToursArchive` namespace to `messages/en.json`**:
```json
"ToursArchive": {
  "eyebrow": "Search tour",
  "title": "Travel With Us",
  "resultsCount": "{count} tours",
  "empty": "No tours match your search.",
  "sortDate": "Date",
  "sortPriceAsc": "Price Low to High",
  "sortPriceDesc": "Price High to Low",
  "sortName": "Name (A-Z)",
  "filterTitle": "Plan Your Trip",
  "searchPlaceholder": "Search tours",
  "minPrice": "Min price",
  "maxPrice": "Max price",
  "apply": "Filter",
  "clear": "Clear",
  "paginationAria": "Tours pagination"
}
```

- [ ] **Step 2: Add the same namespace (Vietnamese) to `messages/vi.json`**:
```json
"ToursArchive": {
  "eyebrow": "Tìm tour",
  "title": "Du lịch cùng chúng tôi",
  "resultsCount": "{count} tour",
  "empty": "Không có tour nào phù hợp.",
  "sortDate": "Mới nhất",
  "sortPriceAsc": "Giá thấp đến cao",
  "sortPriceDesc": "Giá cao đến thấp",
  "sortName": "Tên (A-Z)",
  "filterTitle": "Lên kế hoạch chuyến đi",
  "searchPlaceholder": "Tìm tour",
  "minPrice": "Giá tối thiểu",
  "maxPrice": "Giá tối đa",
  "apply": "Lọc",
  "clear": "Xóa lọc",
  "paginationAria": "Phân trang tour"
}
```

- [ ] **Step 3: Implement `app/[locale]/tours/page.tsx`** (RSC):
```tsx
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { listTours } from "@/lib/api/tours";
import { parseToursQuery } from "@/features/tours/tours-query";
import { ToursArchive } from "@/features/tours/tours-archive";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ToursPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ToursArchive");

  const query = parseToursQuery(await searchParams);
  const { tours, meta } = await listTours(query);

  return (
    <ToursArchive
      tours={tours}
      meta={meta}
      locale={locale}
      text={{
        eyebrow: t("eyebrow"),
        title: t("title"),
        resultsCount: (n) => t("resultsCount", { count: n }),
        emptyLabel: t("empty"),
        sort: { date: t("sortDate"), priceAsc: t("sortPriceAsc"), priceDesc: t("sortPriceDesc"), name: t("sortName") },
        filter: { title: t("filterTitle"), searchPlaceholder: t("searchPlaceholder"), minPrice: t("minPrice"), maxPrice: t("maxPrice"), apply: t("apply"), clear: t("clear") },
        paginationAria: t("paginationAria"),
      }}
    />
  );
}
```

> `searchParams` is a Promise in Next 16 — await it. Confirm against `apps/web` patterns (the home page already awaits `params`).

- [ ] **Step 4: Implement `app/[locale]/tours/loading.tsx`**:
```tsx
import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ShimmerSkeleton className="h-64 w-full rounded-3xl" />
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-[1fr_320px]">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerSkeleton key={i} className="h-80 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
```

> Confirm `ShimmerSkeleton` export/props (A used it in its `loading.tsx`; mirror that usage).

- [ ] **Step 5: Typecheck + lint + full test run**
```bash
pnpm --filter @tourism/web typecheck
pnpm --filter @tourism/web lint
pnpm --filter @tourism/web test
```
Expected: clean/green.

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/app/[locale]/tours apps/web/messages/en.json apps/web/messages/vi.json
git commit -m "feat(web): /tours archive route + loading + i18n"
```

---

## Task 8: Manual verification + DoD

- [ ] **Step 1: Run backend + web** (two terminals): `pnpm --filter @tourism/api start:dev` and `pnpm --filter @tourism/web dev`. Open `http://localhost:3001/en/tours`.

- [ ] **Step 2: Verify**
- [ ] Grid renders real tours **with images** (Cloudinary) — no broken/empty cards.
- [ ] Sort buttons change the URL (`?sortBy=...&sortOrder=...`) and reorder results; active state shows.
- [ ] Search + price Apply update the URL (`?q=`, `?minPrice=`, `?maxPrice=`) and filter; Clear resets.
- [ ] Pagination changes `?page=` and the grid; page resets to 1 when a filter changes.
- [ ] `/vi/tours` shows Vietnamese labels + VI tour titles + VND prices.
- [ ] A no-match query (e.g. `?q=zzzzz`) shows the empty state, not a crash.
- [ ] Result count reflects `meta.total`.

- [ ] **Step 3: Update roadmap** — in `docs/planning/roadmap.md` mark "Customer FE — B1 Packages Archive" done, linking this plan/spec. Commit:
```bash
git add docs/planning/roadmap.md
git commit -m "docs: mark customer FE B1 Packages Archive complete"
```

- [ ] **Step 4: Integrate** — per the user's workflow, **rebase-and-merge** to master (linear history), then delete the branch:
```bash
git checkout master
git rebase feat/customer-fe-browse-archive   # or: git merge --ff-only feat/customer-fe-browse-archive
git push origin master
git branch -d feat/customer-fe-browse-archive
git push origin --delete feat/customer-fe-browse-archive   # only if it was pushed
```
> Confirm with the user before pushing master.

---

## Self-review (author)

- **Spec coverage:** route+RSC+searchParams (T7), sort/filter/pagination controls (T5), grid reuse TourCard (T4), `listTours` meta (T1), Cloudinary image fix (T3), i18n (T7), loading/empty/error (T7+T4, error boundary from A), tests ≥80% (T1,T2,T4), DoD (T8). All spec §1–10 covered.
- **Type consistency:** `ToursQueryInput` defined in `lib/api/tours.ts` and reused as `ToursQuery` in `tours-query.ts`; `ApiTour`/`toTourCardModel` imported from A; `PaginationMeta` defined once (T1) and consumed in T6. `serializeToursQuery`/`parseToursQuery` names consistent across T2/T5.
- **Placeholder scan:** none; uncertain library APIs (zod coerce, pagination-control, Input, ShimmerSkeleton, searchParams await) are flagged as verify-and-adjust `>` notes, not blanks.
- **Reuse:** TourCard, ShimmerSkeleton, button-custom, pagination-control, Shadcn Studio hero — all called out.
