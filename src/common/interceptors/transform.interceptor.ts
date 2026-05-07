import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../types/api-response';

/**
 * Wraps every successful response in the standard envelope:
 *   { data, error: null, meta? }
 *
 * If a controller returns an object that already includes a `meta` field,
 * it is hoisted to the envelope-level meta and stripped from `data`.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    _ctx: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((payload) => {
        if (
          payload &&
          typeof payload === 'object' &&
          'data' in (payload as object) &&
          ('error' in (payload as object) || 'meta' in (payload as object))
        ) {
          // Already shaped — pass through.
          return payload as unknown as ApiResponse<T>;
        }

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

        return { data: payload, error: null };
      }),
    );
  }
}
