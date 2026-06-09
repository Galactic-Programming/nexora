import { describe, it, expect } from "vitest";
import { sanitizeReturnTo } from "./redirect";

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
  });
});
