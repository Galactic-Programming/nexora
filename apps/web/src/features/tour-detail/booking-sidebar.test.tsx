import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookingSidebar } from "./booking-sidebar";
import type { DepartureVM } from "./detail-view-model";

// Mock next-intl Link
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className, "aria-label": ariaLabel }: { href: string; children: React.ReactNode; className?: string; "aria-label"?: string }) => (
    <a href={href} className={className} aria-label={ariaLabel}>{children}</a>
  ),
}));

const deps: DepartureVM[] = [
  { id: "d1", startDate: "2027-06-01", endDate: "2027-06-02", seatsLeft: 3, soldOut: false, price: 149 },
];

const text = { title: "Book This Tour", bookNow: "Book now", seatsLeft: (n: number) => `${n} seats left`, empty: "No upcoming departures", from: "from" };

describe("BookingSidebar", () => {
  it("renders a row per departure with seats left and price", () => {
    render(<BookingSidebar slug="hoi-an-walking" departures={deps} currency="USD" localeTag="en-US" text={text} />);
    expect(screen.getByText("3 seats left")).toBeInTheDocument();
    expect(screen.getByText(/2027/)).toBeInTheDocument();
  });
  it("renders empty state when there are no departures", () => {
    render(<BookingSidebar slug="hoi-an-walking" departures={[]} currency="USD" localeTag="en-US" text={text} />);
    expect(screen.getByText("No upcoming departures")).toBeInTheDocument();
  });
  it("renders a Book link per departure pointing at the book page", () => {
    render(<BookingSidebar slug="hoi-an-walking" departures={deps} currency="USD" localeTag="en-US" text={text} />);
    const link = screen.getByRole("link", { name: /Book now/ });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/tours/hoi-an-walking/book?departure="),
    );
  });
  it("renders no Book link for a sold-out departure", () => {
    const soldOut: DepartureVM[] = [
      { id: "d2", startDate: "2027-07-01", endDate: "2027-07-02", seatsLeft: 0, soldOut: true, price: 199 },
    ];
    render(<BookingSidebar slug="hoi-an-walking" departures={soldOut} currency="USD" localeTag="en-US" text={text} />);
    expect(screen.queryByRole("link", { name: /Book now/ })).toBeNull();
  });
});
