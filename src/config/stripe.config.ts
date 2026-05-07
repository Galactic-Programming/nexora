import { registerAs } from '@nestjs/config';

/**
 * Strongly-typed shape of the `stripe.*` config namespace.
 * Will be consumed by Sprint B3 (`PaymentsService`, webhook handler).
 */
export type StripeConfig = ReturnType<typeof stripeConfig>;

/**
 * Stripe credentials and defaults.
 *
 * - `secretKey` is used to construct the `Stripe` SDK client at runtime.
 *   It MUST be the test-mode key (`sk_test_...`) in non-prod environments.
 * - `webhookSecret` (`whsec_...`) is used by the webhook controller to
 *   verify the `Stripe-Signature` header. Different secrets per env, so
 *   never hard-code.
 * - `defaultCurrency` is the fallback when a Booking doesn't specify one;
 *   stored lowercase per Stripe's API requirement (e.g. `'usd'`, `'vnd'`).
 *
 * @returns Frozen-at-boot Stripe configuration. Both secrets are required —
 *          {@link envValidationSchema} guarantees they're present.
 */
export const stripeConfig = registerAs('stripe', () => ({
  secretKey: process.env.STRIPE_SECRET_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  defaultCurrency: process.env.STRIPE_DEFAULT_CURRENCY ?? 'usd',
}));
