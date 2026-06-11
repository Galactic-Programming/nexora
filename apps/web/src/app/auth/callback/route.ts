import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncUser } from "@/features/auth/actions";
import { sanitizeReturnTo, pathLocale } from "@/features/auth/redirect";
import { callbackErrorFlag } from "@/features/auth/auth-error";

/**
 * Exchanges the `?code` from a Supabase email-verify / recovery / OAuth link
 * for a session, mirrors the user (best-effort), then redirects to the
 * sanitized `next` path. Non-localized so next-intl cannot prefix it.
 * Error bounces reuse the locale carried inside `next` (when present) so a
 * VI user is not dumped onto the EN sign-in.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeReturnTo(url.searchParams.get("next"));
  const locale = pathLocale(next);
  const prefix = locale ? `/${locale}` : "";

  // Errors arrive as ?error=... (no code): OAuth provider failures / user
  // cancel, but ALSO expired email OTP links (error_code=otp_expired) — route
  // each to the matching sign-in flag so the message isn't misleading.
  if (url.searchParams.get("error")) {
    const flag = callbackErrorFlag(url.searchParams.get("error_code"));
    return NextResponse.redirect(new URL(`${prefix}/sign-in?error=${flag}`, url.origin));
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const sync = await syncUser();
      if (!sync.ok) {
        console.error("[auth/callback] syncUser failed:", sync.error);
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  // No code or exchange failed → bounce to sign-in with an error flag.
  return NextResponse.redirect(new URL(`${prefix}/sign-in?error=link`, url.origin));
}
