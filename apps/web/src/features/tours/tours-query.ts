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
