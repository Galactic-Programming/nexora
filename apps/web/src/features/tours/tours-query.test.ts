import { describe, it, expect } from "vitest";
import { parseToursQuery, serializeToursQuery, PAGE_SIZE } from "./tours-query";

describe("parseToursQuery", () => {
  it("applies defaults for empty params", () => {
    expect(parseToursQuery({})).toEqual({
      page: 1, pageSize: PAGE_SIZE, sortBy: "createdAt", sortOrder: "desc",
    });
  });

  it("reads valid filters and coerces numbers", () => {
    const q = parseToursQuery({ page: "2", q: "lantern", minPrice: "30", maxPrice: "200", sortBy: "basePrice", sortOrder: "asc" });
    expect(q).toMatchObject({ page: 2, q: "lantern", minPrice: 30, maxPrice: 200, sortBy: "basePrice", sortOrder: "asc" });
  });

  it("falls back to defaults on invalid values", () => {
    const q = parseToursQuery({ page: "-3", sortBy: "evil", sortOrder: "sideways" });
    expect(q.page).toBe(1);
    expect(q.sortBy).toBe("createdAt");
    expect(q.sortOrder).toBe("desc");
  });

  it("takes the first value when a param repeats", () => {
    expect(parseToursQuery({ q: ["a", "b"] }).q).toBe("a");
  });
});

describe("serializeToursQuery", () => {
  it("omits defaults and undefined", () => {
    const sp = serializeToursQuery({ page: 1, pageSize: PAGE_SIZE, sortBy: "createdAt", sortOrder: "desc" });
    expect(sp.toString()).toBe("");
  });

  it("includes non-default values", () => {
    const sp = serializeToursQuery({ page: 2, pageSize: PAGE_SIZE, q: "x", minPrice: 30, sortBy: "basePrice", sortOrder: "asc" });
    expect(sp.get("page")).toBe("2");
    expect(sp.get("q")).toBe("x");
    expect(sp.get("minPrice")).toBe("30");
    expect(sp.get("sortBy")).toBe("basePrice");
    expect(sp.get("sortOrder")).toBe("asc");
  });
});
