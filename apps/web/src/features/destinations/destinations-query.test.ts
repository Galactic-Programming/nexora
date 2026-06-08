import { describe, it, expect } from "vitest";
import { parseDestinationsQuery, serializeDestinationsQuery, DEST_PAGE_SIZE } from "./destinations-query";

describe("parseDestinationsQuery", () => {
  it("applies defaults", () => {
    expect(parseDestinationsQuery({})).toEqual({ page: 1, pageSize: DEST_PAGE_SIZE });
  });
  it("reads page + search; first value on repeat", () => {
    expect(parseDestinationsQuery({ page: "3", q: ["hoi", "x"] })).toMatchObject({ page: 3, search: "hoi" });
  });
  it("falls back to page 1 on invalid", () => {
    expect(parseDestinationsQuery({ page: "-2" }).page).toBe(1);
  });
});

describe("serializeDestinationsQuery", () => {
  it("omits defaults", () => {
    expect(serializeDestinationsQuery({ page: 1, pageSize: DEST_PAGE_SIZE }).toString()).toBe("");
  });
  it("includes page>1 and q", () => {
    const sp = serializeDestinationsQuery({ page: 2, pageSize: DEST_PAGE_SIZE, search: "hoi" });
    expect(sp.get("page")).toBe("2");
    expect(sp.get("q")).toBe("hoi");
  });
});
