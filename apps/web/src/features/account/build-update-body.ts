import type { UpdateMeBody } from "@/lib/api/users";
import type { ProfileValues } from "./schema";

/** The subset of UserDto fields this form can read for diffing. */
export interface ProfileOriginal {
  fullName: string | null;
  phone: string | null;
  locale: "en" | "vi";
}

/**
 * Builds a PATCH body containing only fields that changed vs `original` and are
 * non-empty after trim. Empty optional inputs are omitted (the backend rejects
 * an empty phone; PATCH semantics treat an absent field as unchanged). An
 * unchanged form yields `{}`, which the caller treats as a no-op.
 */
export function buildUpdateBody(original: ProfileOriginal, values: ProfileValues): UpdateMeBody {
  const body: UpdateMeBody = {};

  const nextName = values.fullName.trim();
  if (nextName !== "" && nextName !== (original.fullName ?? "")) {
    body.fullName = nextName;
  }

  const nextPhone = values.phone.trim();
  if (nextPhone !== "" && nextPhone !== (original.phone ?? "")) {
    body.phone = nextPhone;
  }

  if (values.locale !== original.locale) {
    body.locale = values.locale;
  }

  return body;
}
