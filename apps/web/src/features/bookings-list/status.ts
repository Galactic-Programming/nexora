import type { components } from "@/lib/api/schema";

export type BookingStatus = components["schemas"]["BookingDto"]["status"];

/** Visual tone for the status badge — maps to theme-token classes in the badge. */
export type BookingStatusTone = "positive" | "neutral" | "muted" | "info";

export interface BookingStatusView {
  /** i18n key under the `Bookings.status` namespace. */
  labelKey: string;
  tone: BookingStatusTone;
}

/**
 * Maps a booking status to its badge label key + tone. Exhaustive over the
 * four backend statuses; the `never` default guards against a future status
 * being added without updating this map.
 */
export function mapBookingStatus(status: BookingStatus): BookingStatusView {
  switch (status) {
    case "PAID":
      return { labelKey: "status.paid", tone: "positive" };
    case "PENDING":
      return { labelKey: "status.pending", tone: "neutral" };
    case "CANCELLED":
      return { labelKey: "status.cancelled", tone: "muted" };
    case "REFUNDED":
      return { labelKey: "status.refunded", tone: "info" };
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
