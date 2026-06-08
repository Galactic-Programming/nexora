# Customer FE — B3 Destinations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the destinations list (`/[locale]/destinations`) and detail (`/[locale]/destinations/[slug]`) pages — detail shows the destination's tours by reusing B1's TourGrid — plus seed destination media.

**Architecture:** Mirrors B1/B2: raw-envelope API helpers (`lib/api/destinations.ts`) → RSC pages reading URL search params → `destination-view-model` → focused section components. Detail reuses `listTours({ destination })` + `TourGrid`/`TourCard`. Destination images come from seeded `MediaAsset(DESTINATION)` (read path already attaches media).

**Tech Stack:** Next.js 16 App Router, next-intl, Tailwind v4, `@tourism/ui`, zod, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-06-08-customer-fe-browse-destinations-design.md`
**Branch:** `feat/customer-fe-browse-destinations` (already created).

---

## Conventions & known facts

- Run from repo root; app commands `pnpm --filter @tourism/web ...`, backend `pnpm --filter @tourism/api ...`. `@/` → `apps/web/src`. Windows; don't `cd`; Read/Write/Edit + Bash/PowerShell (don't mix).
- Cost-monitor hook is disabled (`.claude/settings.json` `ECC_DISABLED_HOOKS`) so subagents won't halt.
- Patterns to mirror exactly (read them first): `apps/web/src/lib/api/tours.ts` (`getEnvelope`, `listTours`, `getTour`), `apps/web/src/features/tours/tours-query.ts`, `apps/web/src/features/tours/tour-grid.tsx`, `apps/web/src/features/home/tour-view-model.ts`, B2 `apps/web/src/app/[locale]/tours/[slug]/page.tsx`.
- Backend: `GET /api/v1/destinations` (`page,pageSize,search,sortBy,sortOrder`, isActive) → `{data:[],error,meta}`; `GET /api/v1/destinations/{slug}` → `{data:{},error}` (404 `DESTINATION_NOT_FOUND`). `GET /api/v1/tours?destination=<slug>` filters tours. The destinations service attaches `media` at runtime (`attachToOwner(DESTINATION,…)`).
- Generated types: `components["schemas"]["DestinationDto"]`. **Verify it includes `media` (Task 1 step) — if absent, add `media` to the API `DestinationDto` and regenerate `schema.d.ts`.**

---

## File structure

```text
apps/api/prisma/seed.ts                              # MODIFY: seed destination hero media
apps/api/src/modules/destinations/dto/destination.dto.ts  # MODIFY only if media field missing
apps/web/
  messages/en.json, vi.json                          # MODIFY: Destinations namespace
  src/lib/api/tours.ts                               # MODIFY: ToursQueryInput.destination + listTours
  src/lib/api/destinations.ts (+ .test.ts)           # CREATE: listDestinations, getDestination
  src/features/destinations/
    destinations-query.ts (+ .test.ts)               # CREATE
    destination-view-model.ts (+ .test.ts)           # CREATE
    destination-card.tsx                              # CREATE
    destinations-grid.tsx (+ .test.tsx)              # CREATE
    destinations-search.tsx                           # CREATE (client)
    destinations-archive.tsx                          # CREATE
    destination-detail.tsx                            # CREATE
  src/app/[locale]/destinations/
    page.tsx, loading.tsx                             # CREATE (list)
    [slug]/page.tsx, [slug]/loading.tsx               # CREATE (detail)
```

---

## Task 1: Seed destination media + verify DestinationDto.media

**Files:** Modify `apps/api/prisma/seed.ts`; (maybe) `apps/api/src/modules/destinations/dto/destination.dto.ts`.

- [ ] **Step 1: Verify the DTO + generated type.** Read `apps/api/src/modules/destinations/dto/destination.dto.ts`. If it has NO `media` property, add it mirroring `TourDto.media` (the `@ApiProperty({ type: () => [MediaItemDto] }) media!: MediaItemDto[];`). Then regenerate FE types: start backend (`pnpm --filter @tourism/api start:dev`), run `pnpm --filter @tourism/web api:types`, confirm `components["schemas"]["DestinationDto"]` now has `media`. If it already has `media`, skip the DTO edit.

- [ ] **Step 2: Seed destination hero media.** In `apps/api/prisma/seed.ts`, the destinations are upserted in a loop (`for (const d of DESTINATIONS)` → `prisma.destination.upsert(... )` → `row`). Reuse the existing `TOUR_HERO_SAMPLES` constant (or add a `DESTINATION_HERO_SAMPLES` list of the same verified sample publicIds). After each destination upsert + capturing `row.id`, add idempotent media seeding (mirror the tour media block added earlier in the same file):
```ts
    // Destination hero media (Cloudinary sample) so cards/hero render images.
    const destIdx = DESTINATIONS.indexOf(d);
    await prisma.mediaAsset.deleteMany({
      where: { ownerType: MediaOwnerType.DESTINATION, ownerId: row.id },
    });
    await prisma.mediaAsset.create({
      data: {
        publicId: TOUR_HERO_SAMPLES[destIdx % TOUR_HERO_SAMPLES.length],
        type: MediaType.IMAGE,
        ownerType: MediaOwnerType.DESTINATION,
        ownerId: row.id,
        role: "hero",
        format: "jpg",
        sortOrder: 0,
      },
    });
```
(`MediaOwnerType`/`MediaType` are already imported in seed.ts from Task earlier; if not, add them to the `@prisma/client` import.)

- [ ] **Step 3: Run seed + verify.** `pnpm --filter @tourism/api db:seed`; then with backend running `curl -s http://localhost:3000/api/v1/destinations?pageSize=1` and confirm each destination has a non-empty `media` array with a `res.cloudinary.com` url.

- [ ] **Step 4: Typecheck + commit.** `pnpm --filter @tourism/api typecheck` clean.
```bash
git add apps/api/prisma/seed.ts apps/api/src/modules/destinations/dto/destination.dto.ts apps/web/src/lib/api/schema.d.ts
git commit -m "feat(api): seed destination hero media (+ expose media on DestinationDto if needed)"
```
(Only add `schema.d.ts`/`destination.dto.ts` if you changed them.)

---

## Task 2: API helpers — destinations + listTours destination filter

**Files:** Create `apps/web/src/lib/api/destinations.ts`, `destinations.test.ts`; Modify `apps/web/src/lib/api/tours.ts`.

- [ ] **Step 1: Write the failing test** `apps/web/src/lib/api/destinations.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { listDestinations, getDestination } from "./destinations";

afterEach(() => vi.restoreAllMocks());
function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })));
}

describe("listDestinations", () => {
  it("returns destinations + meta", async () => {
    mockFetch({ data: [{ slug: "hoi-an", nameEn: "Hoi An", media: [] }], error: null, meta: { page: 1, pageSize: 12, total: 1, totalPages: 1 } });
    const res = await listDestinations({ page: 1, pageSize: 12 });
    expect(res.destinations).toHaveLength(1);
    expect(res.meta.total).toBe(1);
  });
  it("sends page/pageSize and search when present", async () => {
    const spy = vi.fn(async (_u: string) => new Response(JSON.stringify({ data: [], error: null, meta: { page: 1, pageSize: 12, total: 0, totalPages: 0 } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", spy);
    await listDestinations({ page: 2, pageSize: 12, search: "hoi" });
    const url = String(spy.mock.calls[0]?.[0]);
    expect(url).toContain("/api/v1/destinations?");
    expect(url).toContain("page=2");
    expect(url).toContain("search=hoi");
  });
});

describe("getDestination", () => {
  it("returns the destination object", async () => {
    mockFetch({ data: { slug: "hoi-an", nameEn: "Hoi An", media: [] }, error: null });
    expect((await getDestination("hoi-an")).slug).toBe("hoi-an");
  });
  it("throws ApiError(404) for missing slug", async () => {
    mockFetch({ data: null, error: { code: "DESTINATION_NOT_FOUND", message: "x" } }, 404);
    await expect(getDestination("ghost")).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });
});
```

- [ ] **Step 2: Run, verify fail.** `pnpm --filter @tourism/web test src/lib/api/destinations.test.ts`.

- [ ] **Step 3: Implement** `apps/web/src/lib/api/destinations.ts`:
```ts
import { env } from "../env";
import { ApiError } from "./errors";
import type { PaginationMeta } from "./tours";
import type { components } from "./schema";

export type Destination = components["schemas"]["DestinationDto"];

export interface DestinationsQueryInput {
  page: number;
  pageSize: number;
  search?: string;
}

type Envelope<T> = { data: T | null; error: { code: string; message: string } | null; meta?: Record<string, unknown> };

async function getEnvelope<T>(path: string): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const res = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}${path}`, { headers: { Accept: "application/json" } });
  let body: Envelope<T>;
  try { body = (await res.json()) as Envelope<T>; }
  catch { throw new ApiError("HTTP_ERROR", `Unexpected non-JSON response (${res.status})`, res.status); }
  if (body.error) throw new ApiError(body.error.code, body.error.message, res.status);
  if (!res.ok) throw new ApiError("HTTP_ERROR", `Unexpected response (${res.status})`, res.status);
  if (body.data === null) throw new ApiError("EMPTY", `Empty response (${res.status})`, res.status);
  return { data: body.data, meta: body.meta };
}

export async function listDestinations(
  query: DestinationsQueryInput,
): Promise<{ destinations: Destination[]; meta: PaginationMeta }> {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  if (query.search) params.set("search", query.search);
  const { data, meta } = await getEnvelope<Destination[]>(`/api/v1/destinations?${params.toString()}`);
  const m = meta ?? {};
  return {
    destinations: data,
    meta: {
      page: typeof m.page === "number" ? m.page : query.page,
      pageSize: typeof m.pageSize === "number" ? m.pageSize : data.length,
      total: typeof m.total === "number" ? m.total : data.length,
      totalPages: typeof m.totalPages === "number" ? m.totalPages : 1,
    },
  };
}

export async function getDestination(slug: string): Promise<Destination> {
  const { data } = await getEnvelope<Destination>(`/api/v1/destinations/${encodeURIComponent(slug)}`);
  return data;
}
```
> This duplicates `getEnvelope` from `tours.ts` (private there). Acceptable parallel for now; do NOT refactor B1/B2 code in this task.

- [ ] **Step 4: Extend `listTours` with `destination`.** In `apps/web/src/lib/api/tours.ts`: add `destination?: string;` to `ToursQueryInput`, and in `listTours` after the other optional params add:
```ts
  if (query.destination) params.set("destination", query.destination);
```

- [ ] **Step 5: Run tests + typecheck.** `pnpm --filter @tourism/web test src/lib/api/destinations.test.ts` → 4 pass; `pnpm --filter @tourism/web typecheck` → clean (existing tours tests still pass).

- [ ] **Step 6: Commit.**
```bash
git add apps/web/src/lib/api/destinations.ts apps/web/src/lib/api/destinations.test.ts apps/web/src/lib/api/tours.ts
git commit -m "feat(web): destinations API helpers + listTours destination filter"
```

---

## Task 3: destinations-query (parse/serialize)

**Files:** Create `apps/web/src/features/destinations/destinations-query.ts`, `.test.ts`.

- [ ] **Step 1: Write the failing test** `destinations-query.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseDestinationsQuery, serializeDestinationsQuery, DEST_PAGE_SIZE } from "./destinations-query";

describe("parseDestinationsQuery", () => {
  it("applies defaults", () => {
    expect(parseDestinationsQuery({})).toEqual({ page: 1, pageSize: DEST_PAGE_SIZE });
  });
  it("reads page + search; first value on repeat", () => {
    expect(parseDestinationsQuery({ page: "3", q: ["hoi", "x"] })).toMatchObject({ page: 3, search: "hoi" });
  });
  it("falls back to page 1 on invalid", () => {
    expect(parseDestinationsQuery({ page: "-2" }).page).toBe(1);
  });
});

describe("serializeDestinationsQuery", () => {
  it("omits defaults", () => {
    expect(serializeDestinationsQuery({ page: 1, pageSize: DEST_PAGE_SIZE }).toString()).toBe("");
  });
  it("includes page>1 and q", () => {
    const sp = serializeDestinationsQuery({ page: 2, pageSize: DEST_PAGE_SIZE, search: "hoi" });
    expect(sp.get("page")).toBe("2");
    expect(sp.get("q")).toBe("hoi");
  });
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement** `destinations-query.ts` (URL uses `q`; API field is `search`):
```ts
import { z } from "zod";
import type { DestinationsQueryInput } from "@/lib/api/destinations";

export const DEST_PAGE_SIZE = 12;
export type DestinationsQuery = DestinationsQueryInput;
type RawParams = Record<string, string | string[] | undefined>;

const schema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  q: z.string().trim().min(1).max(80).optional().catch(undefined),
});

export function parseDestinationsQuery(sp: RawParams): DestinationsQuery {
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = schema.parse(flat);
  return { page: parsed.page, pageSize: DEST_PAGE_SIZE, search: parsed.q };
}

export function serializeDestinationsQuery(q: Partial<DestinationsQuery>): URLSearchParams {
  const sp = new URLSearchParams();
  if (q.page && q.page > 1) sp.set("page", String(q.page));
  if (q.search?.trim()) sp.set("q", q.search.trim());
  return sp;
}
```
> zod v4: if `z.coerce`/`.catch` differ, adapt to the same behavior (see `tours-query.ts`). Keep exports stable.

- [ ] **Step 4: Run, verify pass** (5). **Step 5: Commit.**
```bash
git add apps/web/src/features/destinations/destinations-query.ts apps/web/src/features/destinations/destinations-query.test.ts
git commit -m "feat(web): destinations URL query parse/serialize"
```

---

## Task 4: destination-view-model

**Files:** Create `apps/web/src/features/destinations/destination-view-model.ts`, `.test.ts`.

- [ ] **Step 1: Write the failing test** `destination-view-model.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toDestinationModel } from "./destination-view-model";
import type { Destination } from "@/lib/api/destinations";

const dest = {
  slug: "hoi-an", nameEn: "Hoi An", nameVi: "Hội An", country: "Vietnam", region: "Central",
  descriptionEn: "Lantern town", descriptionVi: "Phố đèn lồng",
  media: [{ url: "https://res.cloudinary.com/x/h.jpg", role: "hero", type: "IMAGE", sortOrder: 0 }],
} as unknown as Destination;

describe("toDestinationModel", () => {
  it("maps EN fields + hero image + href", () => {
    const vm = toDestinationModel(dest, "en");
    expect(vm.name).toBe("Hoi An");
    expect(vm.description).toBe("Lantern town");
    expect(vm.heroImage).toBe("https://res.cloudinary.com/x/h.jpg");
    expect(vm.href).toBe("/destinations/hoi-an");
    expect(vm.region).toBe("Central");
  });
  it("maps VI fields", () => {
    const vm = toDestinationModel(dest, "vi");
    expect(vm.name).toBe("Hội An");
    expect(vm.description).toBe("Phố đèn lồng");
  });
});
```

- [ ] **Step 2: Run, verify fail. Step 3: Implement** `destination-view-model.ts`:
```ts
import type { Destination } from "@/lib/api/destinations";

const isVi = (locale: string) => locale === "vi";

export interface DestinationVM {
  slug: string;
  href: string;
  name: string;
  region?: string;
  country: string;
  description?: string;
  heroImage?: string;
}

export function toDestinationModel(dest: Destination, locale: string): DestinationVM {
  const vi = isVi(locale);
  const media = (dest.media ?? []) as { url: string; role: string }[];
  return {
    slug: dest.slug,
    href: `/destinations/${dest.slug}`,
    name: vi ? dest.nameVi : dest.nameEn,
    region: dest.region ?? undefined,
    country: dest.country,
    description: (vi ? dest.descriptionVi : dest.descriptionEn) ?? undefined,
    heroImage: media.find((m) => m.role === "hero")?.url ?? media[0]?.url,
  };
}
```
> If `dest.media` typing differs (e.g. `MediaItemDto[]`), keep the safe `?? []` + role access; adjust the local cast to the generated media item type.

- [ ] **Step 4: Run, verify pass** (2). **Step 5: Commit.**
```bash
git add apps/web/src/features/destinations/destination-view-model.ts apps/web/src/features/destinations/destination-view-model.test.ts
git commit -m "feat(web): destination view-model (localized props + hero)"
```

---

## Task 5: card + grid + search + archive shell

**Files:** Create `destination-card.tsx`, `destinations-grid.tsx`, `destinations-grid.test.tsx`, `destinations-search.tsx` (client), `destinations-archive.tsx` under `apps/web/src/features/destinations/`.

- [ ] **Step 1: `destination-card.tsx`** (server; image + text; links to detail via next-intl `Link`):
```tsx
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { DestinationVM } from "./destination-view-model";

export function DestinationCard({ destination }: { destination: DestinationVM }) {
  return (
    <Link href={destination.href} className="group border-border block overflow-hidden rounded-2xl border">
      <div className="bg-muted relative aspect-[4/3] overflow-hidden">
        {destination.heroImage && (
          <Image src={destination.heroImage} alt="" fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="(max-width: 640px) 100vw, 33vw" />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-heading text-lg font-semibold">{destination.name}</h3>
        <p className="text-muted-foreground text-xs">{[destination.region, destination.country].filter(Boolean).join(", ")}</p>
        {destination.description && <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">{destination.description}</p>}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: `destinations-grid.test.tsx`**:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DestinationsGrid } from "./destinations-grid";
import type { DestinationVM } from "./destination-view-model";

const items: DestinationVM[] = [
  { slug: "hoi-an", href: "/destinations/hoi-an", name: "Hoi An", country: "Vietnam", region: "Central", description: "Lanterns", heroImage: "https://res.cloudinary.com/x/h.jpg" },
];

describe("DestinationsGrid", () => {
  it("renders a card per destination", () => {
    render(<DestinationsGrid destinations={items} emptyLabel="None" />);
    expect(screen.getByText("Hoi An")).toBeInTheDocument();
  });
  it("renders empty state for []", () => {
    render(<DestinationsGrid destinations={[]} emptyLabel="No destinations" />);
    expect(screen.getByText("No destinations")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: `destinations-grid.tsx`**:
```tsx
import { DestinationCard } from "./destination-card";
import type { DestinationVM } from "./destination-view-model";

export function DestinationsGrid({ destinations, emptyLabel }: { destinations: DestinationVM[]; emptyLabel: string }) {
  if (destinations.length === 0) {
    return <p className="text-muted-foreground py-16 text-center">{emptyLabel}</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {destinations.map((d) => <DestinationCard key={d.slug} destination={d} />)}
    </div>
  );
}
```
Run its test → 2 pass.

- [ ] **Step 4: `destinations-search.tsx`** (client; mirror B1's filter push):
```tsx
"use client";

import { useState } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Button } from "@tourism/ui/components/custom/button-custom";
import { parseDestinationsQuery, serializeDestinationsQuery } from "./destinations-query";

export function DestinationsSearch({ placeholder, submitLabel }: { placeholder: string; submitLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = parseDestinationsQuery(Object.fromEntries(sp.entries()));
  const [q, setQ] = useState(current.search ?? "");

  function apply() {
    const next = serializeDestinationsQuery({ page: 1, pageSize: current.pageSize, search: q.trim() || undefined });
    router.push(`${pathname}?${next.toString()}`);
  }
  return (
    <div className="flex gap-2">
      <input
        value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && apply()}
        placeholder={placeholder} aria-label={placeholder}
        className="border-border w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm"
      />
      <Button onClick={apply}>{submitLabel}</Button>
    </div>
  );
}
```

- [ ] **Step 5: `destinations-archive.tsx`** (server shell):
```tsx
import type { DestinationVM } from "./destination-view-model";
import { DestinationsSearch } from "./destinations-search";
import { DestinationsGrid } from "./destinations-grid";
import { ToursPagination } from "@/features/tours/tours-pagination";

interface Text { eyebrow: string; title: string; resultsCount: (n: number) => string; empty: string; searchPlaceholder: string; search: string; paginationAria: string; }

export function DestinationsArchive({ destinations, total, totalPages, text }: {
  destinations: DestinationVM[]; total: number; totalPages: number; text: Text;
}) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="bg-muted rounded-3xl px-6 py-16 text-center">
        <span className="text-muted-foreground text-sm tracking-[0.3em] uppercase">{text.eyebrow}</span>
        <h1 className="font-heading mt-3 text-4xl font-semibold sm:text-6xl">{text.title}</h1>
      </section>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">{text.resultsCount(total)}</p>
        <DestinationsSearch placeholder={text.searchPlaceholder} submitLabel={text.search} />
      </div>
      <div className="mt-6">
        <DestinationsGrid destinations={destinations} emptyLabel={text.empty} />
        <ToursPagination totalPages={totalPages} ariaLabel={text.paginationAria} />
      </div>
    </main>
  );
}
```
> NOTE: fix the typo `class_name` → `className` (left intentionally as a reminder that the implementer must write valid JSX). `ToursPagination` (B1) reads/writes the `page` URL param generically, so it works here too — confirm it doesn't hard-depend on tours-only params; it uses `parseToursQuery` which only reads `page` for pagination, compatible. If it conflicts, build a tiny local pagination mirroring it.

- [ ] **Step 6: typecheck + commit.**
```bash
pnpm --filter @tourism/web typecheck
git add apps/web/src/features/destinations/destination-card.tsx apps/web/src/features/destinations/destinations-grid.tsx apps/web/src/features/destinations/destinations-grid.test.tsx apps/web/src/features/destinations/destinations-search.tsx apps/web/src/features/destinations/destinations-archive.tsx
git commit -m "feat(web): destinations card, grid, search, archive shell"
```

> Re-evaluate `ToursPagination` reuse during impl: it lives in `features/tours/`. Reusing cross-feature is fine, but if its `parseToursQuery` import pulls tours-only concerns awkwardly, prefer a small `destinations-pagination.tsx` mirroring it (page→URL via `serializeDestinationsQuery`). Pick the cleaner option; keep the archive's `totalPages`/`ariaLabel` props stable.

---

## Task 6: detail component + routes + i18n

**Files:** Create `destination-detail.tsx`; `app/[locale]/destinations/page.tsx` + `loading.tsx`; `app/[locale]/destinations/[slug]/page.tsx` + `loading.tsx`. Modify `messages/en.json`, `vi.json`.

- [ ] **Step 1: i18n — add `Destinations` namespace to `messages/en.json`** (merge; read first):
```json
"Destinations": {
  "eyebrow": "Where to go",
  "title": "Destinations",
  "resultsCount": "{count} destinations",
  "empty": "No destinations match your search.",
  "searchPlaceholder": "Search destinations",
  "search": "Search",
  "paginationAria": "Destinations pagination",
  "toursTitle": "Tours in {name}",
  "toursEmpty": "No tours here yet.",
  "region": "Region",
  "country": "Country"
}
```

- [ ] **Step 2: same for `messages/vi.json`** (merge):
```json
"Destinations": {
  "eyebrow": "Điểm đến",
  "title": "Điểm đến",
  "resultsCount": "{count} điểm đến",
  "empty": "Không có điểm đến phù hợp.",
  "searchPlaceholder": "Tìm điểm đến",
  "search": "Tìm",
  "paginationAria": "Phân trang điểm đến",
  "toursTitle": "Tour tại {name}",
  "toursEmpty": "Chưa có tour ở đây.",
  "region": "Khu vực",
  "country": "Quốc gia"
}
```

- [ ] **Step 3: `destination-detail.tsx`** (hero + info + tours grid, reusing B1 `TourGrid`):
```tsx
import type { DestinationVM } from "./destination-view-model";
import type { ApiTour } from "@/features/home/tour-view-model";
import { DetailHero } from "@/features/tour-detail/detail-hero";
import { TourGrid } from "@/features/tours/tour-grid";

export function DestinationDetail({ destination, tours, locale, text }: {
  destination: DestinationVM;
  tours: ApiTour[];
  locale: string;
  text: { eyebrow: string; toursTitle: (name: string) => string; toursEmpty: string };
}) {
  return (
    <main className="flex flex-col">
      <DetailHero image={destination.heroImage} eyebrow={text.eyebrow} title={destination.name} />
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-muted-foreground text-sm">{[destination.region, destination.country].filter(Boolean).join(", ")}</p>
        {destination.description && <p className="mt-3 max-w-prose">{destination.description}</p>}
      </section>
      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <h2 className="font-heading mb-6 text-2xl font-semibold">{text.toursTitle(destination.name)}</h2>
        <TourGrid tours={tours} locale={locale} emptyLabel={text.toursEmpty} />
      </section>
    </main>
  );
}
```
> Reuses B2's `DetailHero` and B1's `TourGrid` (which maps via `toTourCardModel`). Confirm both import paths.

- [ ] **Step 4: list `app/[locale]/destinations/page.tsx`** (RSC):
```tsx
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listDestinations } from "@/lib/api/destinations";
import { parseDestinationsQuery } from "@/features/destinations/destinations-query";
import { toDestinationModel } from "@/features/destinations/destination-view-model";
import { DestinationsArchive } from "@/features/destinations/destinations-archive";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DestinationsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Destinations");
  const query = parseDestinationsQuery(await searchParams);
  const { destinations, meta } = await listDestinations(query);
  return (
    <DestinationsArchive
      destinations={destinations.map((d) => toDestinationModel(d, locale))}
      total={meta.total}
      totalPages={meta.totalPages}
      text={{
        eyebrow: t("eyebrow"), title: t("title"),
        resultsCount: (n) => t("resultsCount", { count: n }),
        empty: t("empty"), searchPlaceholder: t("searchPlaceholder"), search: t("search"),
        paginationAria: t("paginationAria"),
      }}
    />
  );
}
```

- [ ] **Step 5: detail `app/[locale]/destinations/[slug]/page.tsx`** (RSC):
```tsx
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getDestination } from "@/lib/api/destinations";
import { listTours } from "@/lib/api/tours";
import { ApiError } from "@/lib/api/errors";
import { toDestinationModel } from "@/features/destinations/destination-view-model";
import { DestinationDetail } from "@/features/destinations/destination-detail";
import type { ApiTour } from "@/features/home/tour-view-model";

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function DestinationDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Destinations");

  let dest;
  try { dest = await getDestination(slug); }
  catch (err) {
    if (ApiError.isApiError(err) && err.status === 404) notFound();
    throw err;
  }
  // Tours in this destination are non-critical; degrade to empty on failure.
  const { tours } = await listTours({ page: 1, pageSize: 6, sortBy: "createdAt", sortOrder: "desc", destination: slug })
    .catch(() => ({ tours: [] as ApiTour[], meta: { page: 1, pageSize: 6, total: 0, totalPages: 0 } }));

  return (
    <DestinationDetail
      destination={toDestinationModel(dest, locale)}
      tours={tours}
      locale={locale}
      text={{ eyebrow: t("eyebrow"), toursTitle: (name) => t("toursTitle", { name }), toursEmpty: t("toursEmpty") }}
    />
  );
}
```
> `listTours` returns `{ tours, meta }` (B1). `detail` typing: if TS flags `dest` "used before assigned", type it `let dest: Awaited<ReturnType<typeof getDestination>>;` (notFound returns never).

- [ ] **Step 6: loading files.** `app/[locale]/destinations/loading.tsx` (skeleton grid like B1's tours loading) and `app/[locale]/destinations/[slug]/loading.tsx` (skeleton hero + grid like B2's). Mirror those existing files' `ShimmerSkeleton` usage.
```tsx
// list loading.tsx
import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ShimmerSkeleton aria-hidden="true" className="h-48 w-full rounded-3xl" />
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <ShimmerSkeleton key={i} aria-hidden="true" className="h-64 w-full rounded-2xl" />)}
      </div>
    </div>
  );
}
```
```tsx
// [slug]/loading.tsx
import { ShimmerSkeleton } from "@tourism/ui/components/custom/shimmer-skeleton";
export default function Loading() {
  return (
    <div className="flex flex-col">
      <ShimmerSkeleton aria-hidden="true" className="h-[42vh] w-full" />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <ShimmerSkeleton key={i} aria-hidden="true" className="h-72 w-full rounded-xl" />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: verify + commit.**
```bash
pnpm --filter @tourism/web typecheck
pnpm --filter @tourism/web lint
pnpm --filter @tourism/web test
node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/vi.json','utf8'));JSON.parse(require('fs').readFileSync('apps/web/messages/en.json','utf8'));console.log('json ok')"
git add "apps/web/src/app/[locale]/destinations" apps/web/src/features/destinations/destination-detail.tsx apps/web/messages/en.json apps/web/messages/vi.json
git commit -m "feat(web): destinations list + detail routes, detail component, i18n"
```

> Optional: add a `/destinations` link to `components/layout/main-nav.tsx`/`mobile-nav.tsx` if not already present (B1 added a `/destinations` nav item that currently 404s — this task makes it resolve). Verify and leave the existing nav entry.

---

## Task 7: Manual verification + DoD + merge

- [ ] **Step 1: Run backend + web** (`start:dev` + `dev`). Open `http://localhost:3001/en/destinations`.
- [ ] **Step 2: Verify** — list shows destination cards **with images** + search (changes `?q=`) + pagination; click a card → `/en/destinations/[slug]` shows hero + info + a grid of that destination's tours (cards link to `/tours/[slug]` = B2); `/vi/destinations` localized; unknown slug → localized not-found; no console errors.
- [ ] **Step 3: Update roadmap** — mark "Customer FE — B3 Destinations" done + note Phase B complete in `docs/planning/roadmap.md`. Commit.
- [ ] **Step 4: Integrate (rebase-and-merge, linear)** — confirm with user before pushing master:
```bash
git checkout master
git merge --ff-only feat/customer-fe-browse-destinations
git push origin master
git branch -d feat/customer-fe-browse-destinations
```

---

## Self-review (author)

- **Spec coverage:** seed media + DTO verify (T1), destinations helpers + listTours filter (T2), query (T3), view-model (T4), card/grid/search/archive (T5), detail + routes + i18n + loading (T6), verify/DoD/merge (T7). Spec §1–8 covered.
- **Type consistency:** `Destination` (T2) → `DestinationVM` (T4) → card/grid/archive/detail (T5/T6). `DestinationsQueryInput` (T2) reused as `DestinationsQuery` (T3). `listTours`/`ApiTour`/`TourGrid`/`DetailHero` reused from B1/B2 with existing signatures. Pagination via B1 `ToursPagination` (flagged to swap for a local one if it conflicts).
- **Placeholders:** none; verify-and-adjust `>` notes for DestinationDto.media presence, zod v4, ToursPagination reuse, media item typing. The deliberate `class_name` typo in T5 step 5 is explicitly called out to fix.
- **Reuse:** TourGrid/TourCard/toTourCardModel, DetailHero, ToursPagination, ShimmerSkeleton, Badge, next/image, existing not-found/error boundaries.
