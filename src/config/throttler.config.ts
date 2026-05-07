import { registerAs } from '@nestjs/config';

export type ThrottlerEnvConfig = ReturnType<typeof throttlerConfig>;

export const throttlerConfig = registerAs('throttler', () => ({
  ttlSeconds: parseInt(process.env.THROTTLE_TTL_SECONDS ?? '60', 10),
  limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
}));
