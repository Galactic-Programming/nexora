import { z } from "zod";

// Validation messages are STABLE KEYS under the `Auth` i18n namespace; the
// forms render them via `t(key)`. Keep keys in sync with messages/*.json.
const email = z.string().email("validation.emailInvalid");
// Keys passwordMax / passwordMin / emailInvalid / passwordMismatch must exist in the Auth i18n namespace (messages/*.json).
const password = z.string().min(8, "validation.passwordMin").max(72, "validation.passwordMax");

export const signInSchema = z.object({ email, password });
export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({ email, password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "validation.passwordMismatch",
    path: ["confirmPassword"],
  });
export type SignUpValues = z.infer<typeof signUpSchema>;

export const forgotSchema = z.object({ email });
export type ForgotValues = z.infer<typeof forgotSchema>;

export const resetSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "validation.passwordMismatch",
    path: ["confirmPassword"],
  });
export type ResetValues = z.infer<typeof resetSchema>;
