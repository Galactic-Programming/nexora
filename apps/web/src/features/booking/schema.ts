import { z } from "zod";

// Mirrors backend CreateBookingDto (tourSlug is supplied by the page, not
// the form). Validation messages are STABLE KEYS under the `Booking`
// namespace — keep in sync with messages/*.json.
const phone = z
  .string()
  .trim()
  .refine((v) => v === "" || (v.length >= 6 && v.length <= 30), {
    message: "errors.phoneLength",
  });

export const bookingSchema = z.object({
  departureId: z.string().uuid("errors.departureRequired"),
  numAdults: z.number().int().min(1, "errors.adultsRange").max(20, "errors.adultsRange"),
  numChildren: z.number().int().min(0, "errors.childrenRange").max(20, "errors.childrenRange"),
  contactName: z.string().trim().min(1, "errors.nameRequired").max(120, "errors.nameMax"),
  contactEmail: z.string().email("errors.emailInvalid").max(200, "errors.emailInvalid"),
  contactPhone: phone,
  specialRequests: z.string().trim().max(1000, "errors.requestsMax"),
});

export type BookingValues = z.infer<typeof bookingSchema>;
