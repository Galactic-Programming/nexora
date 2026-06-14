import { Link } from "@/i18n/navigation";
import type { Booking } from "@/lib/api/bookings";
import { bookingDateRange, pickTourTitle, type Locale } from "./format";
import { BookingStatusBadge } from "./BookingStatusBadge";

export interface BookingRowText {
  /** Already-translated status label for the row's status. */
  statusLabel: string;
  /** Seats summary, e.g. "2 adult(s), 1 child(ren)". */
  seats: string;
  totalLabel: string;
}

/**
 * One booking as a tappable card linking to its detail page. Pure sync server
 * component — the parent resolves i18n + currency and passes display strings.
 */
export function BookingRow({
  booking,
  locale,
  money,
  text,
}: {
  booking: Booking;
  locale: Locale;
  money: (amount: string, currency: string) => string;
  text: BookingRowText;
}) {
  const title = pickTourTitle(booking.tour, locale);
  const dates = bookingDateRange(booking.departure.startDate, booking.departure.endDate, locale);

  return (
    <li>
      <Link
        href={`/account/bookings/${booking.code}`}
        className="border-border hover:bg-muted/40 flex flex-col gap-2 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <BookingStatusBadge status={booking.status} label={text.statusLabel} />
            <span className="text-muted-foreground font-mono text-xs">{booking.code}</span>
          </div>
          <p className="truncate font-medium">{title}</p>
          <p className="text-muted-foreground text-sm">{dates}</p>
          <p className="text-muted-foreground text-sm">{text.seats}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs">{text.totalLabel}</p>
          <p className="font-semibold">{money(booking.totalAmount, booking.currency)}</p>
        </div>
      </Link>
    </li>
  );
}
