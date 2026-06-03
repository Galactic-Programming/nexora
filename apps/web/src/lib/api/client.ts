import createClient from "openapi-fetch";
import type { Middleware } from "openapi-fetch";
import type { paths } from "./schema";
import { env } from "../env";
import { ApiError } from "./errors";

type Envelope = {
  data: unknown;
  error: { code: string; message: string } | null;
};

/**
 * Re-wraps a backend response so openapi-fetch sees the INNER data shape that
 * the generated types describe. Throws ApiError when the envelope carries an
 * error. Non-JSON responses (e.g. 204) pass through untouched.
 */
export async function unwrapEnvelope(response: Response): Promise<Response> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = (await response.clone().json()) as Envelope;
  if (body.error) {
    throw new ApiError(body.error.code, body.error.message, response.status);
  }
  return new Response(JSON.stringify(body.data), {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}

const envelopeMiddleware: Middleware = {
  async onResponse({ response }) {
    return unwrapEnvelope(response);
  },
};

/**
 * Server-side client. Pass an Authorization header per-call for authed routes
 * (later phases); public routes need no token.
 */
export function createApiClient(accessToken?: string) {
  const client = createClient<paths>({
    baseUrl: env.NEXT_PUBLIC_API_BASE_URL,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  client.use(envelopeMiddleware);
  return client;
}
