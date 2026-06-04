import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TourGrid } from "./tour-grid";
import type { ApiTour } from "@/features/home/tour-view-model";

const tour = {
  slug: "alpha", titleEn: "Alpha Tour", titleVi: "Alpha VI",
  summaryEn: "s", summaryVi: "s", basePrice: "100.00", currency: "USD",
  durationDays: 2, category: "DAY", isFeatured: false,
  averageRating: 4.2, reviewsCount: 3,
  media: [{ url: "https://res.cloudinary.com/x/a.jpg", role: "hero", type: "IMAGE", sortOrder: 0 }],
} as ApiTour;

describe("TourGrid", () => {
  it("renders a card per tour", () => {
    render(<TourGrid tours={[tour]} locale="en" emptyLabel="None" />);
    expect(screen.getByText("Alpha Tour")).toBeInTheDocument();
  });

  it("renders the empty label when there are no tours", () => {
    render(<TourGrid tours={[]} locale="en" emptyLabel="No tours match" />);
    expect(screen.getByText("No tours match")).toBeInTheDocument();
  });
});
