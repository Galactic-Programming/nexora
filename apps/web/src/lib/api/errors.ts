/** Typed error thrown by the API client when the backend envelope has `error`. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }

  static isApiError(value: unknown): value is ApiError {
    return value instanceof ApiError;
  }
}
