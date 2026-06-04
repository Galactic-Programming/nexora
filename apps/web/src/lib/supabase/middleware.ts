import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "../env";

/**
 * Refreshes the Supabase session cookie on each request and returns the
 * response carrying any updated cookies. Compose this with the i18n middleware.
 */
export async function updateSupabaseSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet, headers) => {
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );
  // A refresh failure (transient Supabase outage, expired refresh token) must
  // not crash the whole middleware chain and take down every page load.
  try {
    await supabase.auth.getUser();
  } catch {
    // Non-fatal: continue with the response as-is.
  }
  return response;
}
