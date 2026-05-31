import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 renamed the "middleware" file convention to "proxy".
// next-intl's handler is the same function; only the filename changed.
export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for API routes, Next internals, and files
  // with an extension (e.g. /favicon.ico, /image.png).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
