import { registerAs } from '@nestjs/config';

export type StripeConfig = ReturnType<typeof stripeConfig>;

export const stripeConfig = registerAs('stripe', () => ({
  secretKey: process.env.STRIPE_SECRET_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  defaultCurrency: process.env.STRIPE_DEFAULT_CURRENCY ?? 'usd',
}));
