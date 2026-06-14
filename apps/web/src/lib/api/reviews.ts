import { createApiClient } from "./client";
import { ApiError } from "./errors";
import type { components } from "./schema";

export type CreateReviewBody = components["schemas"]["CreateReviewDto"];
export type CreatedReview = components["schemas"]["ReviewDto"];

/** Creates a review for one of the caller's PAID bookings (pending approval). */
export async function createReview(
  token: string,
  body: CreateReviewBody,
): Promise<CreatedReview> {
  const { data } = await createApiClient(token).POST("/api/v1/reviews", { body });
  if (!data) throw new ApiError("EMPTY", "Empty /reviews response", 200);
  return data;
}
