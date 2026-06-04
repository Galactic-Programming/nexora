import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSupabaseSession } from "./lib/supabase/middleware";

const handleI18n = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = handleI18n(request);
  return updateSupabaseSession(request, response);
}

export const config = {
  // Match all pathnames except for API routes, Next internals, and files
  // with an extension (e.g. /favicon.ico, /image.png).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
