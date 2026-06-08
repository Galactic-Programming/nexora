import { describe, it, expect } from "vitest";
import { toDestinationModel } from "./destination-view-model";
import type { Destination } from "@/lib/api/destinations";

const dest = {
  slug: "hoi-an", nameEn: "Hoi An", nameVi: "Hội An", country: "Vietnam", region: "Central",
  descriptionEn: "Lantern town", descriptionVi: "Phố đèn lồng",
  media: [{ url: "https://res.cloudinary.com/x/h.jpg", role: "hero", type: "IMAGE", sortOrder: 0 }],
} as unknown as Destination;

describe("toDestinationModel", () => {
  it("maps EN fields + hero image + href", () => {
    const vm = toDestinationModel(dest, "en");
    expect(vm.name).toBe("Hoi An");
    expect(vm.description).toBe("Lantern town");
    expect(vm.heroImage).toBe("https://res.cloudinary.com/x/h.jpg");
    expect(vm.href).toBe("/destinations/hoi-an");
    expect(vm.region).toBe("Central");
  });
  it("maps VI fields", () => {
    const vm = toDestinationModel(dest, "vi");
    expect(vm.name).toBe("Hội An");
    expect(vm.description).toBe("Phố đèn lồng");
  });
});
