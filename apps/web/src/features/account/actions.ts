"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateMe } from "@/lib/api/users";
import { profileSchema, type ProfileValues } from "./schema";
import { buildUpdateBody, type ProfileOriginal } from "./build-update-body";

export interface UpdateProfileInput {
  /** URL locale segment, used to revalidate the correct /{locale}/account path. */
  locale: string;
  original: ProfileOriginal;
  values: ProfileValues;
}

export type UpdateProfileResult =
  | { ok: true }
  | { ok: true; noop: true }
  | { ok: false; error: "NO_SESSION" | "VALIDATION" | "REQUEST_FAILED" };

/**
 * Partial-updates the signed-in user's profile. Re-validates server-side,
 * sends only changed/non-empty fields, and no-ops when nothing changed.
 */
export async function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "NO_SESSION" };

  const parsed = profileSchema.safeParse(input.values);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  const body = buildUpdateBody(input.original, parsed.data);
  if (Object.keys(body).length === 0) return { ok: true, noop: true };

  try {
    await updateMe(session.access_token, body);
    revalidatePath(`/${input.locale}/account`);
    return { ok: true };
  } catch {
    return { ok: false, error: "REQUEST_FAILED" };
  }
}
