import { describe, it, expect, vi, afterEach } from "vitest";
import { listDestinations, getDestination } from "./destinations";

afterEach(() => vi.restoreAllMocks());
function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
    ),
  );
}

describe("listDestinations", () => {
  it("returns destinations + meta", async () => {
    mockFetch({
      data: [{ slug: "hoi-an", nameEn: "Hoi An", media: [] }],
      error: null,
      meta: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
    });
    const res = await listDestinations({ page: 1, pageSize: 12 });
    expect(res.destinations).toHaveLength(1);
    expect(res.meta.total).toBe(1);
  });
  it("sends page/pageSize and search when present", async () => {
    const spy = vi.fn(
      async (_u: string) =>
        new Response(
          JSON.stringify({
            data: [],
            error: null,
            meta: { page: 1, pageSize: 12, total: 0, totalPages: 0 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", spy);
    await listDestinations({ page: 2, pageSize: 12, search: "hoi" });
    const url = String(spy.mock.calls[0]?.[0]);
    expect(url).toContain("/api/v1/destinations?");
    expect(url).toContain("page=2");
    expect(url).toContain("search=hoi");
  });
});

describe("getDestination", () => {
  it("returns the destination object", async () => {
    mockFetch({ data: { slug: "hoi-an", nameEn: "Hoi An", media: [] }, error: null });
    expect((await getDestination("hoi-an")).slug).toBe("hoi-an");
  });
  it("throws ApiError(404) for missing slug", async () => {
    mockFetch({ data: null, error: { code: "DESTINATION_NOT_FOUND", message: "x" } }, 404);
    await expect(getDestination("ghost")).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });
});
