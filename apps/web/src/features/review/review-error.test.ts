import { describe, it, expect } from "vitest";
import { mapReviewError } from "./review-error";

describe("mapReviewError", () => {
  it("maps REVIEW_NOT_ELIGIBLE", () => {
    expect(mapReviewError("REVIEW_NOT_ELIGIBLE")).toBe("errors.notEligible");
  });
  it("maps REVIEW_ALREADY_EXISTS", () => {
    expect(mapReviewError("REVIEW_ALREADY_EXISTS")).toBe("errors.alreadyReviewed");
  });
  it("maps ownership/not-found codes to generic", () => {
    expect(mapReviewError("BOOKING_NOT_FOUND")).toBe("errors.generic");
    expect(mapReviewError("BOOKING_FORBIDDEN")).toBe("errors.generic");
  });
  it("falls back to generic for unknown/undefined", () => {
    expect(mapReviewError("WHATEVER")).toBe("errors.generic");
    expect(mapReviewError(undefined)).toBe("errors.generic");
  });
});
