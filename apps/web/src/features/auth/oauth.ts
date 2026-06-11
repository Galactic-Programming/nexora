/**
 * Builds the Supabase OAuth `redirectTo` URL: the non-localized /auth/callback
 * with `next=/{locale}{returnTo}` so the post-exchange redirect keeps both the
 * locale and the original destination. `returnTo` MUST already be sanitized
 * (sanitizeReturnTo) by the caller; a root returnTo ("/") collapses to just
 * the locale segment.
 */
export function buildOAuthRedirect(origin: string, locale: string, returnTo: string): string {
  const next = `/${locale}${returnTo === "/" ? "" : returnTo}`;
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}
