import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  createBookingRequest: vi.fn(),
  getBookingByCode: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getSession: h.getSession } }),
}));
vi.mock("@/lib/api/bookings", () => ({
  createBookingRequest: h.createBookingRequest,
  getBookingByCode: h.getBookingByCode,
}));

import { createBooking, getBookingStatus } from "./actions";
import { ApiError } from "@/lib/api/errors";

const values = {
  departureId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  numAdults: 2,
  numChildren: 0,
  contactName: "A",
  contactEmail: "a@x.com",
  contactPhone: "",
  specialRequests: "",
};

beforeEach(() => {
  h.getSession.mockReset();
  h.createBookingRequest.mockReset();
  h.getBookingByCode.mockReset();
  h.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

describe("createBooking", () => {
  it("returns NO_SESSION without a session", async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    expect(await createBooking("sa-pa", values)).toEqual({ ok: false, code: "NO_SESSION" });
    expect(h.createBookingRequest).not.toHaveBeenCalled();
  });
  it("returns VALIDATION on bad values", async () => {
    expect(await createBooking("sa-pa", { ...values, numAdults: 0 })).toEqual({ ok: false, code: "VALIDATION" });
  });
  it("omits empty optionals and returns code + url on success", async () => {
    h.createBookingRequest.mockResolvedValue({ bookingCode: "BK-X", checkoutUrl: "https://stripe/u" });
    const res = await createBooking("sa-pa", values);
    expect(res).toEqual({ ok: true, bookingCode: "BK-X", checkoutUrl: "https://stripe/u" });
    const sent = h.createBookingRequest.mock.calls[0]![1] as Record<string, unknown>;
    expect(sent.tourSlug).toBe("sa-pa");
    expect(sent).not.toHaveProperty("contactPhone");
    expect(sent).not.toHaveProperty("specialRequests");
  });
  it("surfaces the ApiError code on backend rejection", async () => {
    h.createBookingRequest.mockRejectedValue(new ApiError("DEPARTURE_DEPARTED", "past", 400));
    expect(await createBooking("sa-pa", values)).toEqual({ ok: false, code: "DEPARTURE_DEPARTED" });
  });
  it("maps non-ApiError failures to REQUEST_FAILED", async () => {
    h.createBookingRequest.mockRejectedValue(new Error("boom"));
    expect(await createBooking("sa-pa", values)).toEqual({ ok: false, code: "REQUEST_FAILED" });
  });
});

describe("getBookingStatus", () => {
  it("returns status + display fields on success", async () => {
    h.getBookingByCode.mockResolvedValue({
      code: "BK-X", status: "PAID", totalAmount: "99.00", currency: "USD",
      numAdults: 2, numChildren: 0,
    });
    const res = await getBookingStatus("BK-X");
    expect(res).toMatchObject({ ok: true, status: "PAID", booking: { code: "BK-X" } });
  });
  it("returns ok:false on any failure (poll loop retries)", async () => {
    h.getBookingByCode.mockRejectedValue(new ApiError("BOOKING_NOT_FOUND", "nf", 404));
    expect(await getBookingStatus("BK-X")).toEqual({ ok: false });
  });
  it("returns ok:false without a session (never calls the API)", async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    expect(await getBookingStatus("BK-X")).toEqual({ ok: false });
    expect(h.getBookingByCode).not.toHaveBeenCalled();
  });
});
