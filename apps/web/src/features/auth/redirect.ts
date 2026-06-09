/**
 * Returns a safe redirect target: only same-origin RELATIVE paths are allowed.
 * Anything else (absolute URL, protocol-relative `//`, backslash tricks, empty)
 * falls back to "/". Prevents open-redirect via `?returnTo=` / callback `next`.
 */
export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value) return "/";
  // Must start with a single "/" and not "//" or "/\" (browser-normalised host).
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
