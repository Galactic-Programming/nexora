import { env } from "../env";
import { ApiError } from "./errors";
import type { ApiTour } from "@/features/home/tour-view-model";
import type { components } from "./schema";

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

  let body: ListEnvelope;
  try {
    body = (await res.json()) as ListEnvelope;
  } catch {
    throw new ApiError("HTTP_ERROR", `Unexpected non-JSON response (${res.status})`, res.status);
  }
  if (body.error) {
    throw new ApiError(body.error.code, body.error.message, res.status);
  }
  if (!res.ok) {
    throw new ApiError("HTTP_ERROR", `Unexpected response (${res.status})`, res.status);
  }

  const tours = body.data ?? [];
  return {
    tours,
    meta: body.meta ?? {
      page: query.page,
      pageSize: query.pageSize,
      total: tours.length,
      totalPages: tours.length ? 1 : 0,
    },
  };
}

// ─── Tour Detail helpers ───────────────────────────────────────────────────

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
  // A 2xx with data:null is unexpected (the backend uses an error envelope +
  // 4xx/5xx for not-found / failures); treat it as an error rather than
  // silently returning null to callers.
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
      page: typeof m.page === "number" ? m.page : page,
      pageSize: typeof m.pageSize === "number" ? m.pageSize : data.length,
      total: typeof m.total === "number" ? m.total : data.length,
      totalPages: typeof m.totalPages === "number" ? m.totalPages : 1,
    },
  };
}
