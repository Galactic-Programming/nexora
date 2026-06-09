import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSupabaseSession } from "./lib/supabase/middleware";

const handleI18n = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  // Non-localized auth route handler (email-verify / recovery / OAuth callback)
  // must NOT be locale-prefixed by next-intl — just refresh the session cookie.
  if (request.nextUrl.pathname.startsWith("/auth/")) {
    return updateSupabaseSession(request, NextResponse.next());
  }
  const response = handleI18n(request);
  return updateSupabaseSession(request, response);
}

export const config = {
  // Match all pathnames except for API routes, Next internals, and files
  // with an extension (e.g. /favicon.ico, /image.png).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
