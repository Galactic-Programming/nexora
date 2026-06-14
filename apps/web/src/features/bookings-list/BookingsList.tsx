import type { Booking } from "@/lib/api/bookings";
import { isTruncatedList, type Locale } from "./format";
import { BookingRow } from "./BookingRow";

export interface BookingsListText {
  /** Resolves the already-translated status label for a given status. */
  statusLabel: (status: Booking["status"]) => string;
  /** Seats summary for a booking row. */
  seats: (numAdults: number, numChildren: number) => string;
  totalLabel: string;
  truncatedNote: string;
}

/**
 * Renders the caller's bookings, newest-first (already ordered by the API).
 * Shows a muted note when the server-side 50-row cap was hit. Pure sync server
 * component — the parent resolves i18n + currency formatting.
 */
export function BookingsList({
  bookings,
  locale,
  money,
  text,
}: {
  bookings: Booking[];
  locale: Locale;
  money: (amount: string, currency: string) => string;
  text: BookingsListText;
}) {
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {bookings.map((booking) => (
          <BookingRow
            key={booking.code}
            booking={booking}
            locale={locale}
            money={money}
            text={{
              statusLabel: text.statusLabel(booking.status),
              seats: text.seats(booking.numAdults, booking.numChildren),
              totalLabel: text.totalLabel,
            }}
          />
        ))}
      </ul>
      {isTruncatedList(bookings) ? (
        <p className="text-muted-foreground text-sm">{text.truncatedNote}</p>
      ) : null}
    </div>
  );
}
