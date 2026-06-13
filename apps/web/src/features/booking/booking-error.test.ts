import { describe, it, expect } from "vitest";
import { mapBookingError } from "./booking-error";

describe("mapBookingError", () => {
  it("maps each backend code to its Booking i18n key", () => {
    expect(mapBookingError("DEPARTURE_DEPARTED")).toBe("errors.departureDeparted");
    expect(mapBookingError("DEPARTURE_NOT_OPEN")).toBe("errors.departureNotOpen");
    expect(mapBookingError("SEATS_NOT_AVAILABLE")).toBe("errors.seatsNotAvailable");
    expect(mapBookingError("TOUR_NOT_FOUND")).toBe("errors.notFound");
    expect(mapBookingError("DEPARTURE_NOT_FOUND")).toBe("errors.notFound");
  });
  it("falls back to generic for anything else", () => {
    expect(mapBookingError("STRIPE_SESSION_INVALID")).toBe("errors.generic");
    expect(mapBookingError(undefined)).toBe("errors.generic");
  });
});
