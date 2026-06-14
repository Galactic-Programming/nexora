import { describe, it, expect } from "vitest";
import { mapBookingStatus } from "./status";

describe("mapBookingStatus", () => {
  it("maps PAID → positive", () => {
    expect(mapBookingStatus("PAID")).toEqual({ labelKey: "status.paid", tone: "positive" });
  });
  it("maps PENDING → neutral", () => {
    expect(mapBookingStatus("PENDING")).toEqual({ labelKey: "status.pending", tone: "neutral" });
  });
  it("maps CANCELLED → muted", () => {
    expect(mapBookingStatus("CANCELLED")).toEqual({ labelKey: "status.cancelled", tone: "muted" });
  });
  it("maps REFUNDED → info", () => {
    expect(mapBookingStatus("REFUNDED")).toEqual({ labelKey: "status.refunded", tone: "info" });
  });
});
