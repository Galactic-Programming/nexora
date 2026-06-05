import { describe, it, expect } from "vitest";
import { toTourDetailModel, toDepartureModel, toReviewModel } from "./detail-view-model";
import type { TourDetail, Departure, PublicReview } from "@/lib/api/tours";

const tour = {
  slug: "phu-quoc", titleEn: "Phu Quoc Cruise", titleVi: "Du thuyền Phú Quốc",
  summaryEn: "Sunset", summaryVi: "Hoàng hôn", basePrice: "199.00", currency: "USD",
  durationDays: 2, maxGroupSize: 20, category: "HONEYMOON", difficulty: "EASY",
  included: ["Hotel"], excluded: ["Flights"], meetingPoint: "Pier 1",
  averageRating: 4.6, reviewsCount: 18, peopleGoing: 124,
  media: [
    { url: "https://res.cloudinary.com/x/g.jpg", role: "gallery", type: "IMAGE", sortOrder: 1 },
    { url: "https://res.cloudinary.com/x/h.jpg", role: "hero", type: "IMAGE", sortOrder: 0 },
  ],
  destination: { slug: "phu-quoc", nameEn: "Phu Quoc", nameVi: "Phú Quốc", country: "Vietnam", region: "South" },
  itinerary: [{ dayNumber: 1, titleEn: "Day 1", titleVi: "Ngày 1", descriptionEn: "Board", descriptionVi: "Lên tàu" }],
} as unknown as TourDetail;

describe("toTourDetailModel", () => {
  it("maps EN fields, hero image, gallery, price and destination", () => {
    const vm = toTourDetailModel(tour, "en");
    expect(vm.title).toBe("Phu Quoc Cruise");
    expect(vm.heroImage).toBe("https://res.cloudinary.com/x/h.jpg");
    expect(vm.gallery).toContain("https://res.cloudinary.com/x/g.jpg");
    expect(vm.price).toBe(199);
    expect(vm.destination.name).toBe("Phu Quoc");
    expect(vm.itinerary[0]!.title).toBe("Day 1");
    expect(vm.rating).toBe(4.6);
  });
  it("maps VI fields", () => {
    const vm = toTourDetailModel(tour, "vi");
    expect(vm.title).toBe("Du thuyền Phú Quốc");
    expect(vm.destination.name).toBe("Phú Quốc");
    expect(vm.itinerary[0]!.title).toBe("Ngày 1");
  });
});

describe("toDepartureModel", () => {
  it("computes seats left and resolves price (priceOverride wins)", () => {
    const dep = { id: "d1", startDate: "2027-06-01", endDate: "2027-06-02", priceOverride: "149.00", seatsTotal: 10, seatsBooked: 7, status: "OPEN" } as Departure;
    const vm = toDepartureModel(dep, tour, "en");
    expect(vm.seatsLeft).toBe(3);
    expect(vm.price).toBe(149);
    expect(vm.soldOut).toBe(false);
  });
  it("falls back to basePrice and flags sold out", () => {
    const dep = { id: "d2", startDate: "2027-06-01", endDate: "2027-06-02", priceOverride: null, seatsTotal: 5, seatsBooked: 5, status: "OPEN" } as Departure;
    const vm = toDepartureModel(dep, tour, "en");
    expect(vm.price).toBe(199);
    expect(vm.seatsLeft).toBe(0);
    expect(vm.soldOut).toBe(true);
  });
});

describe("toReviewModel", () => {
  it("maps rating, author fallback and body", () => {
    const r = { id: "r1", rating: 5, title: "Great", body: "Loved it", createdAt: "2026-01-02T00:00:00Z", userFullName: null } as PublicReview;
    const vm = toReviewModel(r, "en");
    expect(vm.rating).toBe(5);
    expect(vm.author).toBe("Anonymous");
    expect(vm.title).toBe("Great");
  });
});
