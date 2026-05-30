import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiError, ApiResponse } from '../types/api-response';

/**
 * Catch-all exception filter that converts any thrown error into the
 * project's standard {@link ApiResponse} envelope.
 *
 * Why a single filter for everything?
 * - Guarantees a consistent client-facing shape on errors (`data: null` +
 *   structured `error`), no matter where the error originated.
 * - Lets controllers / services throw `HttpException` subclasses with rich
 *   payloads (`{ code, message, details }`) and trust this filter to map
 *   them correctly.
 * - Server-side leakage protection: 5xx errors are logged with the original
 *   stack, but the wire response never includes the stack.
 *
 * Registered globally via `APP_FILTER` in `AppModule`.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /**
   * NestJS calls this for any unhandled exception bubbling up from
   * controllers / interceptors / pipes.
   *
   * Mapping rules:
   *  - `HttpException` with a string body  → `{ code: <derived>, message }`.
   *  - `HttpException` with an object body → forward `code`, `message`,
   *    `details` if provided; fall back to derived code + the underlying
   *    message. ValidationPipe yields `message: string[]` which we join
   *    with `'; '` so the client sees one readable line.
   *  - Any other `Error` → 500 + `INTERNAL_SERVER_ERROR` + `error.message`.
   *  - Anything else (thrown non-Error) → 500 + generic envelope.
   *
   * 5xx responses log the full exception at ERROR level for observability;
   * 4xx responses log nothing — they're "expected" client problems.
   *
   * @param exception  The thrown value. Typed `unknown` because TS allows
   *                   any value to be thrown.
   * @param host       Nest's argument host; we narrow to HTTP context.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let error: ApiError = {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        // Built-in shorthand throws like `throw new BadRequestException('msg')`
        // hit this branch.
        error = { code: this.statusToCode(status), message: res };
      } else if (res && typeof res === 'object') {
        // Structured throw: `throw new ForbiddenException({ code, message, details })`.
        const r = res as Record<string, unknown>;
        const message =
          (Array.isArray(r.message)
            ? (r.message as string[]).join('; ')
            : (r.message as string)) ??
          (r.error as string) ??
          exception.message;
        error = {
          code: (r.code as string) ?? this.statusToCode(status),
          message,
          ...(r.details ? { details: r.details } : {}),
        };
      }
    } else if (exception instanceof Error) {
      // Programmer-error path: keep the message, hide the stack from the wire.
      error = { code: 'INTERNAL_SERVER_ERROR', message: exception.message };
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception as Error,
      );
    }

    const body: ApiResponse<null> = { data: null, error };
    response.status(status).json(body);
  }

  /**
   * Maps the most common HTTP statuses to stable string codes, so frontends
   * can switch on `error.code` without depending on numeric status codes.
   *
   * Not exhaustive — anything not listed falls back to
   * `'INTERNAL_SERVER_ERROR'`, which is intentional: unknown statuses are
   * usually programmer mistakes that warrant the loudest possible label.
   *
   * @param status  HTTP status code (3xx never reaches here in practice).
   * @returns       Stable code string for the wire envelope.
   */
  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
      [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
    };
    return map[status] ?? 'INTERNAL_SERVER_ERROR';
  }
}
