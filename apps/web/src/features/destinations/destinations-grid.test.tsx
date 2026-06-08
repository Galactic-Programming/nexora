import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DestinationsGrid } from "./destinations-grid";
import type { DestinationVM } from "./destination-view-model";

// Mock next/image (no DOM implementation in jsdom)
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// Mock next-intl Link
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const items: DestinationVM[] = [
  {
    slug: "hoi-an",
    href: "/destinations/hoi-an",
    name: "Hoi An",
    country: "Vietnam",
    region: "Central",
    description: "Lanterns",
    heroImage: "https://res.cloudinary.com/x/h.jpg",
  },
];

describe("DestinationsGrid", () => {
  it("renders a card per destination", () => {
    render(<DestinationsGrid destinations={items} emptyLabel="None" />);
    expect(screen.getByText("Hoi An")).toBeInTheDocument();
  });

  it("renders empty state for []", () => {
    render(<DestinationsGrid destinations={[]} emptyLabel="No destinations" />);
    expect(screen.getByText("No destinations")).toBeInTheDocument();
  });
});
