import { describe, it, expect } from "vitest";
import { sanitizeReturnTo, pathLocale } from "./redirect";

describe("sanitizeReturnTo", () => {
  it("allows a same-origin relative path", () => {
    expect(sanitizeReturnTo("/tours")).toBe("/tours");
    expect(sanitizeReturnTo("/tours?x=1#a")).toBe("/tours?x=1#a");
  });
  it("falls back to / for missing or non-relative values", () => {
    expect(sanitizeReturnTo(null)).toBe("/");
    expect(sanitizeReturnTo("")).toBe("/");
    expect(sanitizeReturnTo("tours")).toBe("/");          // not absolute
    expect(sanitizeReturnTo("//evil.com")).toBe("/");      // protocol-relative
    expect(sanitizeReturnTo("https://evil.com")).toBe("/");
    expect(sanitizeReturnTo("/\\evil")).toBe("/");          // backslash trick
    expect(sanitizeReturnTo("%2F%2Fevil.com")).toBe("/");  // encoded //
  });
});

describe("pathLocale", () => {
  it("returns the leading segment when it is a known locale", () => {
    expect(pathLocale("/vi/account")).toBe("vi");
    expect(pathLocale("/en")).toBe("en");
    expect(pathLocale("/en/tours?x=1")).toBe("en");
  });
  it("ignores a query string attached to the locale segment", () => {
    expect(pathLocale("/en?x=1")).toBe("en");
  });
  it("returns null for unknown or absent locale segments", () => {
    expect(pathLocale("/account")).toBe(null);
    expect(pathLocale("/fr/x")).toBe(null);
    expect(pathLocale("/")).toBe(null);
    expect(pathLocale("")).toBe(null);
  });
});
