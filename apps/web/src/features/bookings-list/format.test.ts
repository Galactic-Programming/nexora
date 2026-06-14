import { describe, it, expect } from "vitest";
import { bookingDateRange, pickTourTitle, isTruncatedList } from "./format";

describe("bookingDateRange", () => {
  it("formats a multi-day range in EN", () => {
    const out = bookingDateRange("2026-06-29", "2026-06-30", "en");
    expect(out).toContain("→");
    expect(out).toMatch(/Jun 29, 2026/);
    expect(out).toMatch(/Jun 30, 2026/);
  });
  it("formats a multi-day range in VI", () => {
    const out = bookingDateRange("2026-06-29", "2026-06-30", "vi");
    expect(out).toContain("→");
    expect(out).toContain("thg 6");
  });
  it("collapses a same-day range to a single date", () => {
    const out = bookingDateRange("2026-06-29", "2026-06-29", "en");
    expect(out).not.toContain("→");
    expect(out).toMatch(/Jun 29, 2026/);
  });
  it("accepts full ISO timestamps too", () => {
    const out = bookingDateRange("2026-06-29T00:00:00.000Z", "2026-06-30T00:00:00.000Z", "en");
    expect(out).toContain("→");
  });
});

describe("pickTourTitle", () => {
  const tour = { slug: "s", titleEn: "Sapa Trek", titleVi: "Trekking Sa Pa" };
  it("picks EN title for en", () => {
    expect(pickTourTitle(tour, "en")).toBe("Sapa Trek");
  });
  it("picks VI title for vi", () => {
    expect(pickTourTitle(tour, "vi")).toBe("Trekking Sa Pa");
  });
});

describe("isTruncatedList", () => {
  it("is false below the cap", () => {
    expect(isTruncatedList(new Array(49).fill(0))).toBe(false);
  });
  it("is true at exactly 50", () => {
    expect(isTruncatedList(new Array(50).fill(0))).toBe(true);
  });
  it("is false above 50 (defensive)", () => {
    expect(isTruncatedList(new Array(51).fill(0))).toBe(false);
  });
});
