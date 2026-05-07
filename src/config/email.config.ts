import { registerAs } from '@nestjs/config';

export type EmailConfig = ReturnType<typeof emailConfig>;

export const emailConfig = registerAs('email', () => ({
  resendApiKey: process.env.RESEND_API_KEY!,
  fromEmail: process.env.RESEND_FROM_EMAIL!,
}));
