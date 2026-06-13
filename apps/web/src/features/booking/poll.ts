export const POLL_INTERVAL_MS = 2_000;
export const POLL_TIMEOUT_MS = 30_000;

export type PollResult =
  | { ok: true; status: "PENDING" | "PAID" | "CANCELLED" | "REFUNDED" }
  | { ok: false };

export type PollState =
  | { kind: "polling"; retries?: number }
  | { kind: "paid" }
  | { kind: "expired" }
  | { kind: "refunded" }
  | { kind: "timeout" }
  | { kind: "fallback" };

/**
 * Pure transition for the success-page poll loop. PENDING keeps polling
 * until POLL_TIMEOUT_MS of elapsed time; a failed fetch is retried once
 * before degrading to the fallback panel (the webhook settles the booking
 * server-side regardless of what this page shows).
 */
export function nextPollState(
  result: PollResult,
  elapsedMs: number,
  retries: number,
): PollState {
  if (!result.ok) {
    return retries < 1 ? { kind: "polling", retries: retries + 1 } : { kind: "fallback" };
  }
  switch (result.status) {
    case "PAID":
      return { kind: "paid" };
    case "CANCELLED":
      return { kind: "expired" };
    case "REFUNDED":
      return { kind: "refunded" };
    case "PENDING":
      return elapsedMs >= POLL_TIMEOUT_MS ? { kind: "timeout" } : { kind: "polling" };
  }
}
