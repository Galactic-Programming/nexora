import { describe, it, expect } from "vitest";
import { nextPollState, POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "./poll";

describe("nextPollState", () => {
  it("keeps polling while PENDING within the timeout window", () => {
    expect(nextPollState({ ok: true, status: "PENDING" }, 4_000, 0)).toEqual({ kind: "polling" });
  });
  it("settles on PAID / CANCELLED / REFUNDED", () => {
    expect(nextPollState({ ok: true, status: "PAID" }, 4_000, 0)).toEqual({ kind: "paid" });
    expect(nextPollState({ ok: true, status: "CANCELLED" }, 4_000, 0)).toEqual({ kind: "expired" });
    expect(nextPollState({ ok: true, status: "REFUNDED" }, 4_000, 0)).toEqual({ kind: "refunded" });
  });
  it("times out after POLL_TIMEOUT_MS of PENDING", () => {
    expect(nextPollState({ ok: true, status: "PENDING" }, POLL_TIMEOUT_MS, 0)).toEqual({ kind: "timeout" });
  });
  it("retries one failed fetch, then falls back", () => {
    expect(nextPollState({ ok: false }, 4_000, 0)).toEqual({ kind: "polling", retries: 1 });
    expect(nextPollState({ ok: false }, 4_000, 1)).toEqual({ kind: "fallback" });
  });
  it("exports sane constants", () => {
    expect(POLL_INTERVAL_MS).toBe(2_000);
    expect(POLL_TIMEOUT_MS).toBe(30_000);
  });
});
