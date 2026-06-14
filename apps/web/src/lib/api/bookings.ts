import { createApiClient } from "./client";
import { ApiError } from "./errors";
import type { components } from "./schema";

export type CreateBookingBody = components["schemas"]["CreateBookingDto"];
export type CreatedBooking = components["schemas"]["CreateBookingResponseDto"];
export type Booking = components["schemas"]["BookingDto"];

/** Creates a PENDING booking + Stripe Checkout session (authed). */
export async function createBookingRequest(
  token: string,
  body: CreateBookingBody,
): Promise<CreatedBooking> {
  const { data } = await createApiClient(token).POST("/api/v1/bookings", { body });
  if (!data) throw new ApiError("EMPTY", "Empty /bookings response", 200);
  return data;
}

/** Fetches one booking by code (owner-or-admin enforced server-side). */
export async function getBookingByCode(token: string, code: string): Promise<Booking> {
  const { data } = await createApiClient(token).GET("/api/v1/bookings/{code}", {
    params: { path: { code } },
  });
  if (!data) throw new ApiError("EMPTY", "Empty /bookings/{code} response", 200);
  return data;
}

/** Lists the caller's bookings, newest first (top 50, owner-scoped server-side). */
export async function getMyBookings(token: string): Promise<Booking[]> {
  const { data } = await createApiClient(token).GET("/api/v1/bookings/me");
  if (!data) throw new ApiError("EMPTY", "Empty /bookings/me response", 200);
  return data;
}
