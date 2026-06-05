import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TourReviews } from "./tour-reviews";
import type { ReviewVM } from "./detail-view-model";

const reviews: ReviewVM[] = [
  { id: "r1", rating: 5, title: "Great", body: "Loved it", author: "Jane", date: "2026-01-02T00:00:00Z" },
];

describe("TourReviews", () => {
  it("renders a review per item with author and body", () => {
    render(<TourReviews reviews={reviews} averageRating={4.6} reviewCount={1} text={{ title: "Reviews", empty: "No reviews yet", average: "avg" }} localeTag="en-US" />);
    expect(screen.getByText("Loved it")).toBeInTheDocument();
    expect(screen.getByText("Jane")).toBeInTheDocument();
  });
  it("renders empty state when there are no reviews", () => {
    render(<TourReviews reviews={[]} averageRating={null} reviewCount={0} text={{ title: "Reviews", empty: "No reviews yet", average: "avg" }} localeTag="en-US" />);
    expect(screen.getByText("No reviews yet")).toBeInTheDocument();
  });
});
