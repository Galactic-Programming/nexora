import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TourPlan } from "./tour-plan";
import type { ItineraryVM } from "./detail-view-model";

const days: ItineraryVM[] = [
  { day: 1, title: "Arrival", description: "Board the boat" },
  { day: 2, title: "Return", description: undefined },
];

describe("TourPlan", () => {
  it("renders one row per itinerary day", () => {
    render(<TourPlan days={days} title="Tour Plan" emptyLabel="No itinerary" />);
    expect(screen.getByText("Arrival")).toBeInTheDocument();
    expect(screen.getByText("Return")).toBeInTheDocument();
  });
  it("renders empty state when there are no days", () => {
    render(<TourPlan days={[]} title="Tour Plan" emptyLabel="No itinerary" />);
    expect(screen.getByText("No itinerary")).toBeInTheDocument();
  });
});
