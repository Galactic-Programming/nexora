import { describe, it, expect, vi, afterEach } from "vitest";
import { getTour, getTourDepartures, getTourReviews } from "./tours";
import { ApiError } from "./errors";

afterEach(() => vi.restoreAllMocks());

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
    ),
  );
}

describe("getTour", () => {
  it("returns the inner tour detail object", async () => {
    mockFetch({ data: { slug: "a", titleEn: "A", media: [] }, error: null });
    const tour = await getTour("a");
    expect(tour.slug).toBe("a");
  });
  it("throws ApiError(404) for an unpublished/missing slug", async () => {
    mockFetch({ data: null, error: { code: "TOUR_NOT_FOUND", message: "not found" } }, 404);
    await expect(getTour("ghost")).rejects.toMatchObject({ name: "ApiError", status: 404, code: "TOUR_NOT_FOUND" });
  });
});

describe("getTourDepartures", () => {
  it("returns the departures array", async () => {
    mockFetch({ data: [{ id: "d1", seatsTotal: 10, seatsBooked: 3 }], error: null });
    const deps = await getTourDepartures("a");
    expect(deps).toHaveLength(1);
    expect(deps[0]?.id).toBe("d1");
  });
});

describe("getTourReviews", () => {
  it("returns reviews + averageRating + meta", async () => {
    mockFetch({ data: [{ id: "r1", rating: 5, body: "great" }], error: null, meta: { page: 1, pageSize: 20, total: 1, totalPages: 1, averageRating: 4.5 } });
    const res = await getTourReviews("a");
    expect(res.reviews).toHaveLength(1);
    expect(res.averageRating).toBe(4.5);
    expect(res.meta.total).toBe(1);
  });
  it("defaults averageRating to null when absent", async () => {
    mockFetch({ data: [], error: null, meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    const res = await getTourReviews("a");
    expect(res.averageRating).toBeNull();
  });
});
