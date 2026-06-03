/**
 * Public barrel for the config layer.
 *
 * Importers (notably `AppModule`) only need to know about this file:
 *
 *     import { appConfig, supabaseConfig, envValidationSchema } from './config';
 *
 * Re-exports every named factory + its `*Config` type, plus the Joi schema.
 */
export * from './app.config';
export * from './supabase.config';
export * from './cloudinary.config';
export * from './stripe.config';
export * from './email.config';
export * from './throttler.config';
export * from './env.validation';
