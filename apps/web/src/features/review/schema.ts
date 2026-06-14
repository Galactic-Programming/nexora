import { z } from "zod";

// Mirrors backend CreateReviewDto (bookingCode is supplied by the page, not
// the form). Validation messages are STABLE KEYS under the `Review` namespace
// — keep in sync with messages/*.json.
export const reviewSchema = z.object({
  rating: z
    .number()
    .int("errors.ratingRequired")
    .min(1, "errors.ratingRequired")
    .max(5, "errors.ratingRequired"),
  title: z.string().trim().max(120, "errors.titleMax"),
  body: z.string().trim().min(10, "errors.bodyMin").max(2000, "errors.bodyMax"),
});

export type ReviewValues = z.infer<typeof reviewSchema>;
