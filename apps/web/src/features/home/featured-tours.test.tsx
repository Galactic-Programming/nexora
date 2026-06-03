import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeaturedToursList } from "./featured-tours";
import type { ApiTour } from "./tour-view-model";

const tours: ApiTour[] = [
  {
    slug: "a",
    titleEn: "Alpha Tour",
    titleVi: "Alpha VI",
    summaryEn: "s",
    summaryVi: "s",
    basePrice: "100.00",
    currency: "USD",
    durationDays: 2,
    category: "DAY",
    isFeatured: true,
    averageRating: 4.2,
    reviewsCount: 3,
    media: [{ url: "https://cdn/a.jpg", role: "hero", type: "IMAGE", sortOrder: 0 }],
  } as ApiTour,
];

describe("FeaturedToursList", () => {
  it("renders a card per tour", () => {
    render(<FeaturedToursList tours={tours} locale="en" emptyLabel="None" />);
    expect(screen.getByText("Alpha Tour")).toBeInTheDocument();
  });

  it("renders the empty label when there are no tours", () => {
    render(<FeaturedToursList tours={[]} locale="en" emptyLabel="No featured tours yet" />);
    expect(screen.getByText("No featured tours yet")).toBeInTheDocument();
  });
});
