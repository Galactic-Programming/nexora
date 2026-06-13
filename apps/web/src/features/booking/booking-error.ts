/** Maps POST /bookings ApiError codes to STABLE KEYS in the Booking namespace. */
export function mapBookingError(code: string | undefined): string {
  switch (code) {
    case "DEPARTURE_DEPARTED":
      return "errors.departureDeparted";
    case "DEPARTURE_NOT_OPEN":
      return "errors.departureNotOpen";
    case "SEATS_NOT_AVAILABLE":
      return "errors.seatsNotAvailable";
    case "TOUR_NOT_FOUND":
    case "DEPARTURE_NOT_FOUND":
      return "errors.notFound";
    default:
      return "errors.generic";
  }
}
