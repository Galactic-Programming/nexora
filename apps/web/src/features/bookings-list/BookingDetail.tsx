import { Link } from "@/i18n/navigation";
import {
  DescriptionList,
  type DescriptionListItem,
} from "@tourism/ui/components/custom/description-list";
import type { Booking } from "@/lib/api/bookings";
import { bookingDateRange, pickTourTitle, type Locale } from "./format";
import { BookingStatusBadge } from "./BookingStatusBadge";

export interface BookingDetailText {
  back: string;
  statusLabel: string;
  statusNote: string;
  seats: string;
  viewTour: string;
  /** "Write a review" CTA label — only rendered for PAID bookings. */
  writeReview: string;
  labels: {
    departure: string;
    travelers: string;
    total: string;
    contact: string;
    email: string;
    phone: string;
    specialRequests: string;
    paidAt: string;
    cancelledAt: string;
  };
}

/**
 * Read-only booking detail. Pure sync server component — parent resolves i18n,
 * currency, and timestamp formatting. There is intentionally no cancel/refund
 * affordance (customers can't self-cancel) and no review affordance yet (D3).
 */
export function BookingDetail({
  booking,
  locale,
  money,
  formatDate,
  text,
}: {
  booking: Booking;
  locale: Locale;
  money: (amount: string, currency: string) => string;
  formatDate: (iso: string) => string;
  text: BookingDetailText;
}) {
  const title = pickTourTitle(booking.tour, locale);
  const dates = bookingDateRange(booking.departure.startDate, booking.departure.endDate, locale);

  const items: DescriptionListItem[] = [
    { label: text.labels.departure, value: dates },
    { label: text.labels.travelers, value: text.seats },
    { label: text.labels.total, value: money(booking.totalAmount, booking.currency) },
    { label: text.labels.contact, value: booking.contactName },
    { label: text.labels.email, value: booking.contactEmail },
  ];
  if (booking.contactPhone) {
    items.push({ label: text.labels.phone, value: booking.contactPhone });
  }
  if (booking.specialRequests) {
    items.push({ label: text.labels.specialRequests, value: booking.specialRequests });
  }
  if (booking.paidAt) {
    items.push({ label: text.labels.paidAt, value: formatDate(booking.paidAt) });
  }
  if (booking.cancelledAt) {
    items.push({ label: text.labels.cancelledAt, value: formatDate(booking.cancelledAt) });
  }

  return (
    <div className="space-y-6">
      <Link
        href="/account/bookings"
        className="text-muted-foreground hover:text-foreground inline-block text-sm"
      >
        ← {text.back}
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <BookingStatusBadge status={booking.status} label={text.statusLabel} />
          <span className="text-muted-foreground font-mono text-xs">{booking.code}</span>
        </div>
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <p className="text-muted-foreground text-sm">{text.statusNote}</p>
      </header>

      <DescriptionList items={items} className="border-border rounded-xl border px-4" />

      <div className="flex flex-wrap items-center gap-4">
        {booking.status === "PAID" ? (
          <Link
            href={`/account/bookings/${booking.code}/review`}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium transition-colors"
          >
            {text.writeReview}
          </Link>
        ) : null}
        <Link
          href={`/tours/${booking.tour.slug}`}
          className="text-primary inline-block text-sm hover:underline"
        >
          {text.viewTour}
        </Link>
      </div>
    </div>
  );
}
