import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  tokens: [] as (string | undefined)[],
}));

vi.mock("@/lib/api/client", () => ({
  createApiClient: (token?: string) => {
    h.tokens.push(token);
    return { GET: h.GET, POST: h.POST };
  },
}));

import { createBookingRequest, getBookingByCode, getMyBookings } from "./bookings";

beforeEach(() => {
  h.GET.mockReset();
  h.POST.mockReset();
  h.tokens.length = 0;
});

const created = { bookingCode: "BK-7K3F92AB", checkoutUrl: "https://checkout.stripe.com/c/pay/cs_x" };
const booking = { id: "b-1", code: "BK-7K3F92AB", status: "PAID" };

describe("createBookingRequest", () => {
  it("POSTs /api/v1/bookings with the body and token", async () => {
    h.POST.mockResolvedValue({ data: created });
    const body = { tourSlug: "sa-pa-trek-2d1n", departureId: "d-1", numAdults: 2, numChildren: 0, contactName: "A", contactEmail: "a@x.com" };
    const res = await createBookingRequest("tok", body);
    expect(res.checkoutUrl).toContain("stripe.com");
    expect(h.POST).toHaveBeenCalledWith("/api/v1/bookings", { body });
    expect(h.tokens).toContain("tok");
  });
  it("propagates ApiError from the envelope middleware", async () => {
    const { ApiError } = await import("./errors");
    h.POST.mockRejectedValue(new ApiError("SEATS_NOT_AVAILABLE", "full", 409));
    await expect(
      createBookingRequest("tok", { tourSlug: "s", departureId: "d", numAdults: 1, numChildren: 0, contactName: "A", contactEmail: "a@x.com" }),
    ).rejects.toMatchObject({ code: "SEATS_NOT_AVAILABLE" });
  });
  it("throws ApiError(EMPTY) when data missing", async () => {
    h.POST.mockResolvedValue({ data: undefined });
    await expect(
      createBookingRequest("tok", { tourSlug: "s", departureId: "d", numAdults: 1, numChildren: 0, contactName: "A", contactEmail: "a@x.com" }),
    ).rejects.toMatchObject({ code: "EMPTY" });
  });
});

describe("getBookingByCode", () => {
  it("GETs /api/v1/bookings/{code} and returns the booking", async () => {
    h.GET.mockResolvedValue({ data: booking });
    const res = await getBookingByCode("tok", "BK-7K3F92AB");
    expect(res.status).toBe("PAID");
    expect(h.GET).toHaveBeenCalledWith("/api/v1/bookings/{code}", {
      params: { path: { code: "BK-7K3F92AB" } },
    });
  });
});

describe("getMyBookings", () => {
  it("GETs /api/v1/bookings/me and returns the list with the token", async () => {
    const rows = [booking, { ...booking, id: "b-2", code: "BK-OTHER1" }];
    h.GET.mockResolvedValue({ data: rows });
    const res = await getMyBookings("tok");
    expect(res).toHaveLength(2);
    expect(res[0]!.code).toBe("BK-7K3F92AB");
    expect(h.GET).toHaveBeenCalledWith("/api/v1/bookings/me");
    expect(h.tokens).toContain("tok");
  });
  it("throws ApiError(EMPTY) when data missing", async () => {
    h.GET.mockResolvedValue({ data: undefined });
    await expect(getMyBookings("tok")).rejects.toMatchObject({ code: "EMPTY" });
  });
});
