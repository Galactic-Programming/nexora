import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ createReview: vi.fn() }));

vi.mock("next-intl", () => ({
  // Return the key itself so assertions can target stable keys.
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("./actions", () => ({ createReview: h.createReview }));

import { ReviewForm } from "./ReviewForm";

beforeEach(() => {
  h.createReview.mockReset();
});

describe("ReviewForm", () => {
  it("renders the rating, title, body fields and submit", () => {
    render(<ReviewForm bookingCode="BK-5ZWGG4K0" />);
    expect(screen.getByText("form.ratingLabel")).toBeInTheDocument();
    expect(screen.getByText("form.bodyLabel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "form.submit" })).toBeInTheDocument();
  });

  it("blocks submit and shows validation when empty (rating 0 + empty body)", async () => {
    render(<ReviewForm bookingCode="BK-5ZWGG4K0" />);
    fireEvent.click(screen.getByRole("button", { name: "form.submit" }));
    await waitFor(() => {
      expect(screen.getByText("errors.ratingRequired")).toBeInTheDocument();
    });
    expect(screen.getByText("errors.bodyMin")).toBeInTheDocument();
    expect(h.createReview).not.toHaveBeenCalled();
  });

  it("links back to the booking", () => {
    render(<ReviewForm bookingCode="BK-5ZWGG4K0" />);
    const back = screen.getByText("form.back").closest("a");
    expect(back).toHaveAttribute("href", "/account/bookings/BK-5ZWGG4K0");
  });
});
