import type { components } from "@/lib/api/schema";

export type Locale = "en" | "vi";

type TourSummary = components["schemas"]["BookingTourSummaryDto"];

/** The server caps `GET /bookings/me` at 50 rows; used to show a "most recent" note. */
const MAX_BOOKINGS = 50;

function localeTag(locale: Locale): string {
  return locale === "vi" ? "vi-VN" : "en-US";
}

/** Parses a `date` (YYYY-MM-DD) or full ISO string into a Date at local midnight. */
function toDate(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
}

/**
 * Localized departure date range. Collapses to a single date when start and
 * end fall on the same calendar day; otherwise "start → end" in the locale's
 * medium date style.
 */
export function bookingDateRange(startISO: string, endISO: string, locale: Locale): string {
  const fmt = new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "medium" });
  const start = fmt.format(toDate(startISO));
  const end = fmt.format(toDate(endISO));
  return start === end ? start : `${start} → ${end}`;
}

/** Picks the title for the active locale. */
export function pickTourTitle(tour: TourSummary, locale: Locale): string {
  return locale === "vi" ? tour.titleVi : tour.titleEn;
}

/** True when the list was capped server-side (exactly 50 rows returned). */
export function isTruncatedList(rows: readonly unknown[]): boolean {
  return rows.length === MAX_BOOKINGS;
}
