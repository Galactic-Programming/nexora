/**
 * Structured error payload returned to clients.
 *
 * @property code     Stable, machine-readable error code (e.g. `'NOT_FOUND'`,
 *                    `'USER_NOT_SYNCED'`). Frontends switch on this — never
 *                    rename a code without coordinating with the FE.
 * @property message  Human-readable message in English. Localized variants
 *                    are produced by `nestjs-i18n` at the controller layer.
 * @property details  Optional payload for validation errors, debug aids, etc.
 *                    Marked `unknown` so callers must narrow before reading.
 */
export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

/**
 * Pagination + arbitrary metadata attached to list responses.
 *
 * The well-known fields (`page`, `pageSize`, `total`, `totalPages`) are typed
 * for IDE auto-complete; the `[key: string]: unknown` index signature lets
 * specific endpoints add their own meta (e.g. cursor tokens, applied filters)
 * without forcing this type to grow.
 */
export type ApiMeta = {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
};

/**
 * Standard envelope wrapping every successful AND failed API response.
 *
 * Why an envelope? Frontends always know where to read data and where to
 * read errors — no per-endpoint bespoke shapes. `data` and `error` are
 * mutually exclusive (`data: null` ↔ `error: ApiError`); enforced at runtime
 * by `TransformInterceptor` (success path) and `HttpExceptionFilter`
 * (failure path).
 *
 * @template T  Type of the `data` payload on success.
 */
export type ApiResponse<T> = {
  data: T | null;
  error: ApiError | null;
  meta?: ApiMeta;
};
