import { SetMetadata } from '@nestjs/common';

/**
 * Reflector key for `@SkipTransform()`. Read by `TransformInterceptor`
 * to bypass envelope-wrapping for a specific route.
 */
export const SKIP_TRANSFORM_KEY = 'skipTransform';

/**
 * Marks a route as opting out of the global `TransformInterceptor`'s
 * `{ data, error, meta }` envelope. Use sparingly — almost every endpoint
 * should keep the envelope so clients can branch on a uniform shape.
 *
 * Legitimate uses:
 *  - Stripe webhook (`POST /payments/webhook`) — Stripe expects a plain
 *    `{ received: true }` (or any 2xx body), and wrapping it breaks the
 *    "fire-and-forget" contract Stripe documents.
 *  - File downloads or binary streams where the framework already handles
 *    the body.
 */
export const SkipTransform = (): MethodDecorator =>
  SetMetadata(SKIP_TRANSFORM_KEY, true);
