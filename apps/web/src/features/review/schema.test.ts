import { describe, it, expect } from "vitest";
import { reviewSchema } from "./schema";

const base = { rating: 5, title: "", body: "Wonderful trip with a great guide." };

describe("reviewSchema", () => {
  it("accepts a valid review with empty optional title", () => {
    expect(reviewSchema.safeParse(base).success).toBe(true);
  });
  it("rejects rating below 1", () => {
    const r = reviewSchema.safeParse({ ...base, rating: 0 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.message).toBe("errors.ratingRequired");
  });
  it("rejects rating above 5", () => {
    expect(reviewSchema.safeParse({ ...base, rating: 6 }).success).toBe(false);
  });
  it("rejects a non-integer rating", () => {
    expect(reviewSchema.safeParse({ ...base, rating: 4.5 }).success).toBe(false);
  });
  it("rejects a body shorter than 10 chars", () => {
    const r = reviewSchema.safeParse({ ...base, body: "too short" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.message).toBe("errors.bodyMin");
  });
  it("accepts a body of exactly 10 chars", () => {
    expect(reviewSchema.safeParse({ ...base, body: "1234567890" }).success).toBe(true);
  });
  it("rejects a body longer than 2000 chars", () => {
    expect(reviewSchema.safeParse({ ...base, body: "x".repeat(2001) }).success).toBe(false);
  });
  it("rejects a title longer than 120 chars", () => {
    const r = reviewSchema.safeParse({ ...base, title: "x".repeat(121) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.message).toBe("errors.titleMax");
  });
});
