import { describe, it, expect } from "vitest";
import { toTourCardModel, type ApiTour } from "./tour-view-model";

const base: ApiTour = {
  slug: "phu-quoc-sunset-cruise",
  titleEn: "Phu Quoc Sunset Cruise",
  titleVi: "Du thuyền hoàng hôn Phú Quốc",
  summaryEn: "Evening cruise",
  summaryVi: "Du thuyền buổi tối",
  basePrice: "199.00",
  currency: "USD",
  durationDays: 1,
  category: "HONEYMOON",
  isFeatured: true,
  averageRating: 4.6,
  reviewsCount: 18,
  media: [
    { url: "https://cdn/x/gallery.jpg", role: "gallery", type: "IMAGE", sortOrder: 1 },
    { url: "https://cdn/x/hero.jpg", role: "hero", type: "IMAGE", sortOrder: 0 },
  ],
} as ApiTour;

describe("toTourCardModel", () => {
  it("maps EN fields, numeric price and the hero image", () => {
    const vm = toTourCardModel(base, "en");
    expect(vm.title).toBe("Phu Quoc Sunset Cruise");
    expect(vm.summary).toBe("Evening cruise");
    expect(vm.price).toBe(199);
    expect(vm.image).toBe("https://cdn/x/hero.jpg");
    expect(vm.href).toBe("/tours/phu-quoc-sunset-cruise");
    expect(vm.locale).toBe("en-US");
  });

  it("maps VI fields and locale", () => {
    const vm = toTourCardModel(base, "vi");
    expect(vm.title).toBe("Du thuyền hoàng hôn Phú Quốc");
    expect(vm.locale).toBe("vi-VN");
  });

  it("falls back to the first media item when there is no hero role", () => {
    const noHero = { ...base, media: [base.media[0]] } as ApiTour;
    expect(toTourCardModel(noHero, "en").image).toBe("https://cdn/x/gallery.jpg");
  });

  it("uses null rating safely", () => {
    const noRating = { ...base, averageRating: null, reviewsCount: 0 } as ApiTour;
    const vm = toTourCardModel(noRating, "en");
    expect(vm.rating).toBeUndefined();
  });
});
