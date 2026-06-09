"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createApiClient } from "@/lib/api/client";

export type SyncResult = { ok: true } | { ok: false; error: "NO_SESSION" | "SYNC_FAILED" };

/**
 * Mirrors the signed-in Supabase user into the local DB via POST /auth/sync,
 * using the server-side access token. Best-effort: callers surface the error
 * and may retry, but a failure does NOT invalidate the Supabase session.
 */
export async function syncUser(): Promise<SyncResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "NO_SESSION" };

  try {
    const api = createApiClient(session.access_token);
    await api.POST("/api/v1/auth/sync", { body: {} });
    return { ok: true };
  } catch {
    return { ok: false, error: "SYNC_FAILED" };
  }
}

/** Signs the user out (clears the Supabase session cookie). */
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
