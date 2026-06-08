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

type Envelope<T> = {
  data: T | null;
  error: { code: string; message: string } | null;
  meta?: Record<string, unknown>;
};

async function getEnvelope<T>(
  path: string,
): Promise<{ data: T; meta?: Record<string, unknown> }> {
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
  if (body.data === null)
    throw new ApiError("EMPTY", `Empty response (${res.status})`, res.status);
  return { data: body.data, meta: body.meta };
}

export async function listDestinations(
  query: DestinationsQueryInput,
): Promise<{ destinations: Destination[]; meta: PaginationMeta }> {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  if (query.search) params.set("search", query.search);
  const { data, meta } = await getEnvelope<Destination[]>(
    `/api/v1/destinations?${params.toString()}`,
  );
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
  const { data } = await getEnvelope<Destination>(
    `/api/v1/destinations/${encodeURIComponent(slug)}`,
  );
  return data;
}
