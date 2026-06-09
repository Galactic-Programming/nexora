/**
 * Returns a safe redirect target: only same-origin RELATIVE paths are allowed.
 * Anything else (absolute URL, protocol-relative `//`, backslash tricks, empty)
 * falls back to "/". Prevents open-redirect via `?returnTo=` / callback `next`.
 *
 * Decodes the value before safety checks so percent-encoded bypass vectors
 * (e.g. `%2F%2Fevil.com`) are rejected. The ORIGINAL (encoded) value is
 * returned when safe to avoid double-decoding downstream.
 */
export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value) return "/";
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return "/";
  }
  // Must be a single-slash relative path; reject protocol-relative "//" and
  // backslash-normalised "/\" host tricks (checked on the decoded form).
  if (!decoded.startsWith("/")) return "/";
  if (decoded.startsWith("//") || decoded.startsWith("/\\")) return "/";
  return value;
}
