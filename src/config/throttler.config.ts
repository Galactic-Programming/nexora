import { registerAs } from '@nestjs/config';

/**
 * Strongly-typed shape of the `throttler.*` config namespace.
 *
 * Note: named `ThrottlerEnvConfig` (not `ThrottlerConfig`) to avoid a name
 * clash with `@nestjs/throttler`'s own exported `ThrottlerConfig` type.
 */
export type ThrottlerEnvConfig = ReturnType<typeof throttlerConfig>;

/**
 * Global rate-limit settings for `@nestjs/throttler`.
 *
 * Defaults: 100 requests per 60 seconds per client IP — generous enough for
 * normal browsing but blocks naive credential-stuffing or scraper bots.
 * Sprint B5 will add tighter per-route limits for `/auth/*` and `/bookings`.
 *
 * `parseInt(..., 10)` converts the env strings ('60', '100') back into the
 * numbers the throttler module expects.
 *
 * @returns Frozen-at-boot throttler configuration consumed by
 *          `ThrottlerModule.forRootAsync()` in `AppModule`.
 */
export const throttlerConfig = registerAs('throttler', () => ({
  ttlSeconds: parseInt(process.env.THROTTLE_TTL_SECONDS ?? '60', 10),
  limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
}));
