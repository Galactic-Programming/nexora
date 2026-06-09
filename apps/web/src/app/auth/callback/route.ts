import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncUser } from "@/features/auth/actions";
import { sanitizeReturnTo } from "@/features/auth/redirect";

/**
 * Exchanges the `?code` from a Supabase email-verify / recovery / OAuth link
 * for a session, mirrors the user (best-effort), then redirects to the
 * sanitized `next` path. Non-localized so next-intl cannot prefix it.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeReturnTo(url.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await syncUser();
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  // No code or exchange failed → bounce to sign-in with an error flag.
  return NextResponse.redirect(new URL("/sign-in?error=link", url.origin));
}
