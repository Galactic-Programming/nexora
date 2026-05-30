import { registerAs } from '@nestjs/config';

/**
 * Strongly-typed shape of the `email.*` config namespace.
 * Will be consumed by Sprint B3 (`EmailService` / Resend client).
 */
export type EmailConfig = ReturnType<typeof emailConfig>;

/**
 * Resend transactional-email credentials.
 *
 * - `resendApiKey` (`re_...`) authenticates the Node SDK; treat as a secret.
 * - `fromEmail` is the RFC 5322 display-name format used as the `From`
 *   header (e.g. `"Tourism API <noreply@example.com>"`). For Resend's free
 *   tier you must use either `onboarding@resend.dev` or a verified domain.
 *
 * @returns Frozen-at-boot email configuration. Both fields are required —
 *          enforced by {@link envValidationSchema}.
 */
export const emailConfig = registerAs('email', () => ({
  resendApiKey: process.env.RESEND_API_KEY!,
  fromEmail: process.env.RESEND_FROM_EMAIL!,
}));
