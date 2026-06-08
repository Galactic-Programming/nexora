import { z } from "zod";
import type { DestinationsQueryInput } from "@/lib/api/destinations";

export const DEST_PAGE_SIZE = 12;
export type DestinationsQuery = DestinationsQueryInput;

type RawParams = Record<string, string | string[] | undefined>;

const schema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  q: z.string().trim().min(1).max(80).optional().catch(undefined),
});

/** Parse Next.js searchParams (string | string[] | undefined) into a typed destinations query. */
export function parseDestinationsQuery(sp: RawParams): DestinationsQuery {
  const flat = Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const parsed = schema.parse(flat);
  return {
    page: parsed.page,
    pageSize: DEST_PAGE_SIZE,
    ...(parsed.q !== undefined && { search: parsed.q }),
  };
}

/** Serialize a destinations query back to URLSearchParams, omitting defaults/empty. */
export function serializeDestinationsQuery(q: Partial<DestinationsQuery>): URLSearchParams {
  const sp = new URLSearchParams();
  if (q.page !== undefined && q.page > 1) sp.set("page", String(q.page));
  if (q.search?.trim()) sp.set("q", q.search.trim());
  return sp;
}
