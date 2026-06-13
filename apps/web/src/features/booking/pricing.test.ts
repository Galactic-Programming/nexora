import { describe, it, expect } from "vitest";
import { computeTotal } from "./pricing";

describe("computeTotal", () => {
  it("multiplies unit price by total seats (adults + children)", () => {
    expect(computeTotal(49.5, 2, 1)).toBe(148.5);
  });
  it("treats children as full seats (backend parity)", () => {
    expect(computeTotal(100, 1, 2)).toBe(300);
  });
  it("rounds to 2 decimals to avoid float noise in display", () => {
    expect(computeTotal(19.99, 3, 0)).toBe(59.97);
    expect(computeTotal(0.1, 3, 0)).toBe(0.3);
  });
});
