import { registerAs } from '@nestjs/config';

/**
 * Strongly-typed shape of the `app.*` namespace returned by {@link appConfig}.
 * Use it via `ConfigService.get<AppConfig>('app')` or by reading individual
 * keys (e.g. `config.get<number>('app.port')`).
 */
export type AppConfig = ReturnType<typeof appConfig>;

/**
 * Application-wide runtime knobs (port, log level, CORS, etc.).
 *
 * Why a factory? `@nestjs/config` calls this lazily AFTER `envValidationSchema`
 * has accepted the environment, so it's safe to read `process.env.*` directly
 * without re-validating. Keeping the factory pure also makes it trivial to
 * unit-test by stubbing `process.env`.
 *
 * The `??` fallbacks mirror the Joi defaults — the validator should normally
 * have populated these already, so the fallbacks are belt-and-braces.
 *
 * @returns Frozen-at-boot configuration values for the bootstrap layer
 *          (`main.ts`) and the global logger / CORS setup.
 */
export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  // Split + trim + drop empties so `"a, b, "` becomes `['a', 'b']` — avoids
  // accidentally whitelisting an empty origin (which would match nothing).
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
  isProduction: process.env.NODE_ENV === 'production',
}));
