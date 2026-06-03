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
  // `meta` (pagination) is intentionally NOT forwarded here. Callers that need
  // it (list endpoints) will gain a dedicated helper when pagination is built.
  return new Response(JSON.stringify(body.data), {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}

// Stateless singleton — safe to share across every client. If this ever needs
// per-client state, move it into createApiClient instead.
const envelopeMiddleware: Middleware = {
  async onResponse({ response }) {
    return unwrapEnvelope(response);
  },
};

/**
 * Typed API client. Use from Server Components or Route Handlers; pass an
 * access token for authed routes (later phases), omit it for public routes.
 */
export function createApiClient(accessToken?: string) {
  const client = createClient<paths>({
    baseUrl: env.NEXT_PUBLIC_API_BASE_URL,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  client.use(envelopeMiddleware);
  return client;
}
