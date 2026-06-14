import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  createReviewRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getSession: h.getSession } }),
}));
vi.mock("@/lib/api/reviews", () => ({
  createReview: h.createReviewRequest,
}));

import { createReview } from "./actions";
import { ApiError } from "@/lib/api/errors";

const values = { rating: 5, title: "", body: "Wonderful trip with a great guide." };

beforeEach(() => {
  h.getSession.mockReset();
  h.createReviewRequest.mockReset();
  h.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

describe("createReview action", () => {
  it("returns NO_SESSION without a session", async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    expect(await createReview("BK-5ZWGG4K0", values)).toEqual({ ok: false, code: "NO_SESSION" });
    expect(h.createReviewRequest).not.toHaveBeenCalled();
  });
  it("returns VALIDATION on bad values", async () => {
    expect(await createReview("BK-5ZWGG4K0", { ...values, rating: 0 })).toEqual({ ok: false, code: "VALIDATION" });
    expect(await createReview("BK-5ZWGG4K0", { ...values, body: "short" })).toEqual({ ok: false, code: "VALIDATION" });
  });
  it("omits empty title, sends bookingCode, returns ok on success", async () => {
    h.createReviewRequest.mockResolvedValue({ id: "r-1", isApproved: false });
    const res = await createReview("BK-5ZWGG4K0", values);
    expect(res).toEqual({ ok: true });
    const sent = h.createReviewRequest.mock.calls[0]![1] as Record<string, unknown>;
    expect(sent.bookingCode).toBe("BK-5ZWGG4K0");
    expect(sent.rating).toBe(5);
    expect(sent).not.toHaveProperty("title");
  });
  it("includes a non-empty title", async () => {
    h.createReviewRequest.mockResolvedValue({ id: "r-1" });
    await createReview("BK-5ZWGG4K0", { ...values, title: "Great" });
    const sent = h.createReviewRequest.mock.calls[0]![1] as Record<string, unknown>;
    expect(sent.title).toBe("Great");
  });
  it("surfaces the ApiError code on backend rejection", async () => {
    h.createReviewRequest.mockRejectedValue(new ApiError("REVIEW_ALREADY_EXISTS", "dup", 409));
    expect(await createReview("BK-5ZWGG4K0", values)).toEqual({ ok: false, code: "REVIEW_ALREADY_EXISTS" });
  });
  it("returns REQUEST_FAILED on a non-Api error", async () => {
    h.createReviewRequest.mockRejectedValue(new Error("boom"));
    expect(await createReview("BK-5ZWGG4K0", values)).toEqual({ ok: false, code: "REQUEST_FAILED" });
  });
});
