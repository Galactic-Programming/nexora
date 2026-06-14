"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createReview as createReviewRequest, type CreateReviewBody } from "@/lib/api/reviews";
import { ApiError } from "@/lib/api/errors";
import { reviewSchema, type ReviewValues } from "./schema";

export type CreateReviewResult = { ok: true } | { ok: false; code: string };

/**
 * Submits a review for one of the caller's PAID bookings. Token is read
 * server-side; the empty optional `title` is OMITTED. Ownership + PAID
 * eligibility + one-per-booking are enforced by the backend; their error
 * codes flow back as `{ ok: false, code }`.
 */
export async function createReview(
  bookingCode: string,
  values: ReviewValues,
): Promise<CreateReviewResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, code: "NO_SESSION" };

  const parsed = reviewSchema.safeParse(values);
  if (!parsed.success) return { ok: false, code: "VALIDATION" };

  const body: CreateReviewBody = {
    bookingCode,
    rating: parsed.data.rating,
    body: parsed.data.body,
    ...(parsed.data.title ? { title: parsed.data.title } : {}),
  };

  try {
    await createReviewRequest(session.access_token, body);
    return { ok: true };
  } catch (err) {
    if (ApiError.isApiError(err)) return { ok: false, code: err.code };
    console.error("createReview failed", err);
    return { ok: false, code: "REQUEST_FAILED" };
  }
}
