import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';
import { ApiResponse } from '../types/api-response';

/**
 * Global response interceptor that normalizes EVERY successful controller
 * return value into the standard {@link ApiResponse} envelope.
 *
 * Why an interceptor instead of forcing each controller to wrap its return?
 * - Controllers stay clean — they return domain types (a `User`, a tour list,
 *   etc.). The wire format becomes the framework's responsibility.
 * - One place to evolve the envelope. If we later add a `requestId` to the
 *   meta, every endpoint gets it for free.
 *
 * Failure path is handled separately by `HttpExceptionFilter`; this
 * interceptor only sees successful (resolved) values.
 *
 * Registered globally via `APP_INTERCEPTOR` in `AppModule`.
 *
 * @template T  Type of the inner `data` payload.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T> | T
> {
  constructor(private readonly reflector: Reflector) {}

  /**
   * NestJS hook invoked between the controller's return and the HTTP
   * response. Four branches:
   *
   *  0. `@SkipTransform()` is set on the handler — pass through verbatim.
   *     Reserved for routes whose body shape is dictated by an external
   *     spec (Stripe webhook ACK, file streams, etc.).
   *  1. The handler already returned a fully-shaped envelope (e.g. a
   *     middleware-style endpoint that needs custom headers via the raw
   *     response). Pass it through unchanged.
   *  2. The handler returned `{ items, meta }` — our convention for
   *     paginated list endpoints. Hoist `meta` to the envelope level and
   *     unwrap `items` to `data`.
   *  3. Anything else: wrap the value as `{ data, error: null }`.
   *
   * @param ctx   Execution context (read for the `@SkipTransform` flag).
   * @param next  The handler whose Observable we transform.
   * @returns     A new Observable that emits the wrapped envelope.
   */
  intercept(
    ctx: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skip) {
      // Branch 0 — opt-out (e.g. Stripe webhook ACK).
      return next.handle();
    }

    return next.handle().pipe(
      map((payload) => {
        // Branch 1 — already shaped. Detect by the presence of `data` AND
        // (`error` or `meta`). Strict enough that domain objects called
        // `data` won't false-match.
        if (
          payload &&
          typeof payload === 'object' &&
          'data' in (payload as object) &&
          ('error' in (payload as object) || 'meta' in (payload as object))
        ) {
          return payload as unknown as ApiResponse<T>;
        }

        // Branch 2 — list-with-meta convention. Pagination services return
        // `{ items: T[], meta: { page, total, ... } }`; we promote `meta`
        // to envelope level so clients can read it without unwrapping.
        if (
          payload &&
          typeof payload === 'object' &&
          'meta' in (payload as Record<string, unknown>) &&
          'items' in (payload as Record<string, unknown>)
        ) {
          const obj = payload as unknown as {
            items: T;
            meta: Record<string, unknown>;
          };
          return { data: obj.items, error: null, meta: obj.meta };
        }

        // Branch 3 — plain value (single resource, primitive, null).
        return { data: payload, error: null };
      }),
    );
  }
}
