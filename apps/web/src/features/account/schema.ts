import { z } from "zod";

// Validation messages are STABLE KEYS under the `Account` i18n namespace.
// Keep keys in sync with messages/*.json (validation.fullNameMax / phoneLength).
const fullName = z.string().trim().max(120, "validation.fullNameMax");

const phone = z
  .string()
  .trim()
  .refine((v) => v === "" || (v.length >= 6 && v.length <= 20), {
    message: "validation.phoneLength",
  });

const locale = z.enum(["en", "vi"]);

export const profileSchema = z.object({ fullName, phone, locale });
export type ProfileValues = z.infer<typeof profileSchema>;
