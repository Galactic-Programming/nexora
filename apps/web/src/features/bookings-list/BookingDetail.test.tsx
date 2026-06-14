import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Booking } from "@/lib/api/bookings";
import { BookingDetail } from "./BookingDetail";

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
    numAdults: 2,
    numChildren: 1,
    totalAmount: "180.00",
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
    departure: { startDate: "2026-06-29", endDate: "2026-06-30", status: "OPEN" },
    ...overrides,
  };
}

const money = (amount: string, currency: string) => `${currency} ${amount}`;
const formatDate = (iso: string) => `formatted(${iso})`;

const text = {
  back: "Back to my bookings",
  statusLabel: "Paid",
  statusNote: "This booking is confirmed.",
  seats: "2 adult(s), 1 child(ren)",
  viewTour: "View tour",
  labels: {
    departure: "Departure",
    travelers: "Travelers",
    total: "Total",
    contact: "Contact",
    email: "Email",
    phone: "Phone",
    specialRequests: "Special requests",
    paidAt: "Paid on",
    cancelledAt: "Cancelled on",
  },
};

describe("BookingDetail", () => {
  it("renders title, status, code, dates, contact and total", () => {
    render(<BookingDetail booking={makeBooking()} locale="en" money={money} formatDate={formatDate} text={text} />);
    expect(screen.getByText("Sapa Trek")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("BK-5ZWGG4K0")).toBeInTheDocument();
    expect(screen.getByText(/Jun 29, 2026/)).toBeInTheDocument();
    expect(screen.getByText("customer@example.com")).toBeInTheDocument();
    expect(screen.getByText("USD 180.00")).toBeInTheDocument();
    expect(screen.getByText("This booking is confirmed.")).toBeInTheDocument();
  });

  it("links back to the list and to the tour page", () => {
    render(<BookingDetail booking={makeBooking()} locale="en" money={money} formatDate={formatDate} text={text} />);
    expect(screen.getByText(/Back to my bookings/).closest("a")).toHaveAttribute("href", "/account/bookings");
    expect(screen.getByText("View tour").closest("a")).toHaveAttribute("href", "/tours/sa-pa-trek-2d1n");
  });

  it("shows paidAt and hides specialRequests when absent", () => {
    render(<BookingDetail booking={makeBooking()} locale="en" money={money} formatDate={formatDate} text={text} />);
    expect(screen.getByText("Paid on")).toBeInTheDocument();
    expect(screen.queryByText("Special requests")).not.toBeInTheDocument();
  });

  it("shows specialRequests when present", () => {
    render(<BookingDetail booking={makeBooking({ specialRequests: "Window seat" })} locale="en" money={money} formatDate={formatDate} text={text} />);
    expect(screen.getByText("Special requests")).toBeInTheDocument();
    expect(screen.getByText("Window seat")).toBeInTheDocument();
  });

  it("shows cancelledAt for a cancelled booking and omits phone when null", () => {
    render(<BookingDetail booking={makeBooking({ status: "CANCELLED", cancelledAt: "2026-06-14T00:00:00.000Z", contactPhone: null })} locale="en" money={money} formatDate={formatDate} text={text} />);
    expect(screen.getByText("Cancelled on")).toBeInTheDocument();
    expect(screen.queryByText("Phone")).not.toBeInTheDocument();
  });
});
