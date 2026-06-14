/** Maps POST /reviews ApiError codes to STABLE KEYS in the Review namespace. */
export function mapReviewError(code: string | undefined): string {
  switch (code) {
    case "REVIEW_NOT_ELIGIBLE":
      return "errors.notEligible";
    case "REVIEW_ALREADY_EXISTS":
      return "errors.alreadyReviewed";
    case "BOOKING_NOT_FOUND":
    case "BOOKING_FORBIDDEN":
    default:
      return "errors.generic";
  }
}
