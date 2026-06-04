import { describe, it, expect, vi, afterEach } from "vitest";
import { listTours } from "./tours";
import { ApiError } from "./errors";

afterEach(() => vi.restoreAllMocks());

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

const tour = { slug: "a", titleEn: "A", media: [] };

describe("listTours", () => {
  it("returns tours + meta from the envelope", async () => {
    mockFetch({ data: [tour], error: null, meta: { page: 1, pageSize: 9, total: 1, totalPages: 1 } });
    const res = await listTours({ page: 1, pageSize: 9, sortBy: "createdAt", sortOrder: "desc" });
    expect(res.tours).toHaveLength(1);
    expect(res.meta).toEqual({ page: 1, pageSize: 9, total: 1, totalPages: 1 });
  });

  it("sends only defined query params", async () => {
    const spy = vi.fn(async (_url: string | URL | Request) =>
      new Response(JSON.stringify({ data: [], error: null, meta: { page: 1, pageSize: 9, total: 0, totalPages: 0 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", spy);
    await listTours({ page: 2, pageSize: 9, q: "lantern", sortBy: "basePrice", sortOrder: "asc" });
    const url = String(spy.mock.calls[0]?.[0]);
    expect(url).toContain("/api/v1/tours?");
    expect(url).toContain("page=2");
    expect(url).toContain("q=lantern");
    expect(url).toContain("sortBy=basePrice");
    expect(url).not.toContain("minPrice");
    expect(url).toContain("pageSize=9");
    expect(url).toContain("sortOrder=asc");
  });

  it("throws ApiError when the envelope carries an error", async () => {
    mockFetch({ data: null, error: { code: "BAD", message: "nope" } }, 400);
    await expect(listTours({ page: 1, pageSize: 9, sortBy: "createdAt", sortOrder: "desc" })).rejects.toMatchObject({
      name: "ApiError",
      code: "BAD",
      status: 400,
    });
    await expect(listTours({ page: 1, pageSize: 9, sortBy: "createdAt", sortOrder: "desc" })).rejects.toBeInstanceOf(ApiError);
  });

  it("throws ApiError on a non-ok response without an error envelope", async () => {
    mockFetch({ data: null, error: null }, 502);
    await expect(
      listTours({ page: 1, pageSize: 9, sortBy: "createdAt", sortOrder: "desc" }),
    ).rejects.toMatchObject({ name: "ApiError", status: 502 });
  });
});
