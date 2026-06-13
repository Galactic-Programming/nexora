"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createBookingRequest,
  getBookingByCode,
  type Booking,
  type CreateBookingBody,
} from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/errors";
import { bookingSchema, type BookingValues } from "./schema";

export type CreateBookingResult =
  | { ok: true; bookingCode: string; checkoutUrl: string }
  | { ok: false; code: string };

/**
 * Creates the PENDING booking + Stripe session. Token is read server-side;
 * empty optional fields are OMITTED (backend phone validator rejects "").
 */
export async function createBooking(
  tourSlug: string,
  values: BookingValues,
): Promise<CreateBookingResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, code: "NO_SESSION" };

  const parsed = bookingSchema.safeParse(values);
  if (!parsed.success) return { ok: false, code: "VALIDATION" };

  const body: CreateBookingBody = {
    tourSlug,
    departureId: parsed.data.departureId,
    numAdults: parsed.data.numAdults,
    numChildren: parsed.data.numChildren,
    contactName: parsed.data.contactName,
    contactEmail: parsed.data.contactEmail,
    ...(parsed.data.contactPhone ? { contactPhone: parsed.data.contactPhone } : {}),
    ...(parsed.data.specialRequests ? { specialRequests: parsed.data.specialRequests } : {}),
  };

  try {
    const created = await createBookingRequest(session.access_token, body);
    return { ok: true, bookingCode: created.bookingCode, checkoutUrl: created.checkoutUrl };
  } catch (err) {
    if (ApiError.isApiError(err)) return { ok: false, code: err.code };
    console.error("createBooking failed", err);
    return { ok: false, code: "REQUEST_FAILED" };
  }
}

export type BookingStatusResult =
  | {
      ok: true;
      status: Booking["status"];
      booking: Pick<Booking, "code" | "totalAmount" | "currency" | "numAdults" | "numChildren">;
    }
  | { ok: false };

/** Poll target for /checkout/success. Failures are soft — the loop retries. */
export async function getBookingStatus(code: string): Promise<BookingStatusResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false };

  try {
    const b = await getBookingByCode(session.access_token, code);
    return {
      ok: true,
      status: b.status,
      booking: {
        code: b.code,
        totalAmount: b.totalAmount,
        currency: b.currency,
        numAdults: b.numAdults,
        numChildren: b.numChildren,
      },
    };
  } catch {
    return { ok: false };
  }
}
