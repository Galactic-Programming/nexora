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
