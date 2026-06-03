import * as Joi from 'joi';

/**
 * Joi schema that validates `process.env` at boot time.
 *
 * Why: a backend that silently boots with a missing/typo'd secret is far
 * more dangerous than one that refuses to start. `@nestjs/config` runs this
 * schema BEFORE any module is initialized — if any rule fails, Nest aborts
 * with the full list of violations.
 *
 * Conventions:
 * - `.required()` means the process MUST NOT start without the value.
 * - `.default(...)` provides a sane fallback for non-secret operational knobs.
 * - `.allow('')` keeps a key declared but optional (used for legacy fields).
 *
 * After this schema accepts the env, downstream code reads typed values
 * through namespaced `registerAs` configs (see neighbouring `*.config.ts`).
 */
export const envValidationSchema = Joi.object({
  // ── App ────────────────────────────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace')
    .default('info'),
  // Comma-separated list, parsed in `app.config.ts`. Empty string allowed so
  // local dev can leave it blank (CORS reflects all origins).
  CORS_ORIGINS: Joi.string().default(''),

  // ── Database (Supabase Postgres via Supavisor) ─────────────────────────────
  // Both URLs are required — runtime queries vs. migrations use different
  // pooler modes. See docs/runbooks/local-dev.md §2.
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  DIRECT_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),

  // ── Supabase Auth ──────────────────────────────────────────────────────────
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_ANON_KEY: Joi.string().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),
  SUPABASE_JWKS_URL: Joi.string().uri().required(),
  // HS256 legacy secret. Optional because new Supabase projects sign with
  // asymmetric keys (ES256/RS256/EdDSA) and don't need it.
  SUPABASE_JWT_SECRET: Joi.string().allow('').optional(),
  // Comma-separated allowlist; empty default means "no admins" until configured.
  ADMIN_EMAILS: Joi.string().default(''),
  // ── Cloudinary (photos + clips) ─────────────────────────────────────────────
  // Replaces Supabase Storage for media. `apiSecret` is used server-side to
  // sign upload requests (`/admin/uploads/signed-url`) — never exposed to the FE.
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),
  // Root folder under which all assets land (e.g. `tourism/tours/hero`).
  CLOUDINARY_UPLOAD_FOLDER: Joi.string().default('tourism'),

  // ── Stripe (test or live) ──────────────────────────────────────────────────
  STRIPE_SECRET_KEY: Joi.string().required(),
  STRIPE_WEBHOOK_SECRET: Joi.string().required(),
  // Stripe expects 3-letter ISO codes in lowercase ('usd', 'vnd', ...).
  STRIPE_DEFAULT_CURRENCY: Joi.string().length(3).lowercase().default('usd'),
  // Used to build success/cancel redirect URLs for Stripe Checkout.
  FRONTEND_URL: Joi.string().uri().required(),

  // ── Email (Resend) ─────────────────────────────────────────────────────────
  RESEND_API_KEY: Joi.string().required(),
  // RFC 5322 display-name format — e.g. `Tourism API <noreply@example.com>`.
  RESEND_FROM_EMAIL: Joi.string().required(),

  // ── Throttler ──────────────────────────────────────────────────────────────
  THROTTLE_TTL_SECONDS: Joi.number().integer().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
});
