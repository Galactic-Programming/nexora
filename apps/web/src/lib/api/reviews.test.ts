import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  POST: vi.fn(),
  tokens: [] as (string | undefined)[],
}));

vi.mock("@/lib/api/client", () => ({
  createApiClient: (token?: string) => {
    h.tokens.push(token);
    return { POST: h.POST };
  },
}));

import { createReview } from "./reviews";

beforeEach(() => {
  h.POST.mockReset();
  h.tokens.length = 0;
});

const created = {
  id: "r-1",
  tourId: "t-1",
  userId: "u-1",
  bookingId: "b-1",
  rating: 5,
  title: "Great",
  body: "Wonderful trip with a great guide.",
  isApproved: false,
  createdAt: "2026-06-14T00:00:00.000Z",
  updatedAt: "2026-06-14T00:00:00.000Z",
};

describe("createReview", () => {
  it("POSTs /api/v1/reviews with the body and token", async () => {
    h.POST.mockResolvedValue({ data: created });
    const body = { bookingCode: "BK-5ZWGG4K0", rating: 5, title: "Great", body: "Wonderful trip with a great guide." };
    const res = await createReview("tok", body);
    expect(res.isApproved).toBe(false);
    expect(h.POST).toHaveBeenCalledWith("/api/v1/reviews", { body });
    expect(h.tokens).toContain("tok");
  });
  it("propagates ApiError from the envelope middleware", async () => {
    const { ApiError } = await import("./errors");
    h.POST.mockRejectedValue(new ApiError("REVIEW_ALREADY_EXISTS", "dup", 409));
    await expect(
      createReview("tok", { bookingCode: "BK-5ZWGG4K0", rating: 5, body: "Wonderful trip with a great guide." }),
    ).rejects.toMatchObject({ code: "REVIEW_ALREADY_EXISTS" });
  });
  it("throws ApiError(EMPTY) when data missing", async () => {
    h.POST.mockResolvedValue({ data: undefined });
    await expect(
      createReview("tok", { bookingCode: "BK-5ZWGG4K0", rating: 5, body: "Wonderful trip with a great guide." }),
    ).rejects.toMatchObject({ code: "EMPTY" });
  });
});
