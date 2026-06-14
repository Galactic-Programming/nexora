import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Booking } from "@/lib/api/bookings";
import { BookingStatusBadge } from "./BookingStatusBadge";
import { BookingRow } from "./BookingRow";
import { BookingsList } from "./BookingsList";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b-1",
    code: "BK-5ZWGG4K0",
    userId: "u-1",
    tourId: "t-1",
    departureId: "d-1",
    numAdults: 1,
    numChildren: 0,
    totalAmount: "59.99",
    currency: "USD",
    status: "PAID",
    contactName: "Updated Name",
    contactEmail: "customer@example.com",
    contactPhone: "+84909999999",
    specialRequests: null,
    stripeSessionId: null,
    stripePaymentIntentId: null,
    paidAt: "2026-06-13T12:08:40.137Z",
    cancelledAt: null,
    createdAt: "2026-06-13T12:00:00.000Z",
    updatedAt: "2026-06-13T12:08:40.137Z",
    tour: { slug: "sa-pa-trek-2d1n", titleEn: "Sapa Trek", titleVi: "Trekking Sa Pa" },
    departure: { startDate: "2026-06-29", endDate: "2026-06-30" },
    ...overrides,
  };
}

const money = (amount: string, currency: string) => `${currency} ${amount}`;

describe("BookingStatusBadge", () => {
  it("renders the translated label text (not color alone)", () => {
    render(<BookingStatusBadge status="PAID" label="Paid" />);
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });
});

describe("BookingRow", () => {
  const text = { statusLabel: "Paid", seats: "1 adult(s), 0 child(ren)", totalLabel: "Total" };

  it("links to the booking detail page by code", () => {
    render(<BookingRow booking={makeBooking()} locale="en" money={money} text={text} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/account/bookings/BK-5ZWGG4K0");
  });
  it("shows the localized tour title, date range, seats and total", () => {
    render(<BookingRow booking={makeBooking()} locale="en" money={money} text={text} />);
    expect(screen.getByText("Sapa Trek")).toBeInTheDocument();
    expect(screen.getByText(/Jun 29, 2026/)).toBeInTheDocument();
    expect(screen.getByText("1 adult(s), 0 child(ren)")).toBeInTheDocument();
    expect(screen.getByText("USD 59.99")).toBeInTheDocument();
    expect(screen.getByText("BK-5ZWGG4K0")).toBeInTheDocument();
  });
  it("picks the VI title for the vi locale", () => {
    render(<BookingRow booking={makeBooking()} locale="vi" money={money} text={text} />);
    expect(screen.getByText("Trekking Sa Pa")).toBeInTheDocument();
  });
});

describe("BookingsList", () => {
  const text = {
    statusLabel: (s: Booking["status"]) => s,
    seats: (a: number, c: number) => `${a} adult(s), ${c} child(ren)`,
    totalLabel: "Total",
    truncatedNote: "Showing your 50 most recent bookings.",
  };

  it("renders one row per booking", () => {
    const bookings = [makeBooking(), makeBooking({ code: "BK-OTHER1", id: "b-2" })];
    render(<BookingsList bookings={bookings} locale="en" money={money} text={text} />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
  it("hides the truncated note below the 50-row cap", () => {
    render(<BookingsList bookings={[makeBooking()]} locale="en" money={money} text={text} />);
    expect(screen.queryByText(/most recent/)).not.toBeInTheDocument();
  });
  it("shows the truncated note at exactly 50 rows", () => {
    const bookings = Array.from({ length: 50 }, (_, i) => makeBooking({ code: `BK-${i}`, id: `b-${i}` }));
    render(<BookingsList bookings={bookings} locale="en" money={money} text={text} />);
    expect(screen.getByText("Showing your 50 most recent bookings.")).toBeInTheDocument();
  });
});
