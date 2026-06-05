import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookingSidebar } from "./booking-sidebar";
import type { DepartureVM } from "./detail-view-model";

const deps: DepartureVM[] = [
  { id: "d1", startDate: "2027-06-01", endDate: "2027-06-02", seatsLeft: 3, soldOut: false, price: 149 },
];

const text = { title: "Book This Tour", bookNow: "Book now", seatsLeft: (n: number) => `${n} seats left`, empty: "No upcoming departures", from: "from" };

describe("BookingSidebar", () => {
  it("renders a row per departure with seats left and price", () => {
    render(<BookingSidebar departures={deps} currency="USD" localeTag="en-US" text={text} />);
    expect(screen.getByText("3 seats left")).toBeInTheDocument();
  });
  it("renders empty state when there are no departures", () => {
    render(<BookingSidebar departures={[]} currency="USD" localeTag="en-US" text={text} />);
    expect(screen.getByText("No upcoming departures")).toBeInTheDocument();
  });
  it("disables the Book Now CTA (booking is phase D)", () => {
    render(<BookingSidebar departures={deps} currency="USD" localeTag="en-US" text={text} />);
    expect(screen.getByRole("button", { name: "Book now" })).toBeDisabled();
  });
});
