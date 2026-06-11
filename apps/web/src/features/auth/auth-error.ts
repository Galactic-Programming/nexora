/** Minimal shape we read off a Supabase AuthError (avoids a hard dep import). */
interface AuthErrorLike {
  message?: string;
}

/**
 * Maps a Supabase auth error to a STABLE KEY under the `Auth` i18n namespace.
 * Matching is substring-based on the English message (Supabase doesn't expose
 * stable codes for these). Unknown errors fall back to `errors.generic`.
 *
 * ORDERING NOTE: `invalid login credentials` MUST be checked before the generic
 * `invalid` substring (which maps to `errors.linkInvalid`) to avoid misrouting.
 */
export function mapAuthError(error: AuthErrorLike | null | undefined): string {
  const msg = error?.message?.toLowerCase() ?? "";
  if (msg.includes("invalid login credentials")) return "errors.invalidCredentials";
  if (msg.includes("email not confirmed")) return "errors.emailNotConfirmed";
  if (msg.includes("already registered")) return "errors.emailTaken";
  if (msg.includes("for security purposes") || msg.includes("rate limit")) return "errors.rateLimited";
  if (msg.includes("expired") || msg.includes("invalid")) return "errors.linkInvalid";
  return "errors.generic";
}

/**
 * Maps the /auth/callback `?error=` flag (carried onto the sign-in URL) to a
 * STABLE KEY under the `Auth` i18n namespace. Unknown/absent flags → null
 * (sign-in renders nothing).
 */
export function mapCallbackError(flag: string | null): string | null {
  if (flag === "link") return "errors.linkInvalid";
  if (flag === "oauth") return "errors.oauthFailed";
  return null;
}
