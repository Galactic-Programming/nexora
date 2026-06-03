import { describe, it, expect, vi, afterEach } from "vitest";
import { unwrapEnvelope } from "./client";
import { ApiError } from "./errors";

afterEach(() => vi.restoreAllMocks());

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("unwrapEnvelope", () => {
  it("returns a Response whose body is the inner data on success", async () => {
    const res = jsonResponse({ data: [{ id: "1" }], error: null });
    const out = await unwrapEnvelope(res);
    expect(await out.json()).toEqual([{ id: "1" }]);
    expect(out.status).toBe(200);
  });

  it("throws ApiError with code+status when the envelope has error", async () => {
    const res = jsonResponse(
      { data: null, error: { code: "TOUR_NOT_FOUND", message: "Tour not found" } },
      404,
    );
    await expect(unwrapEnvelope(res)).rejects.toMatchObject({
      name: "ApiError",
      code: "TOUR_NOT_FOUND",
      status: 404,
    });
    await expect(unwrapEnvelope(res.clone())).rejects.toBeInstanceOf(ApiError);
  });

  it("passes through non-JSON responses untouched", async () => {
    const res = new Response("ok", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
    const out = await unwrapEnvelope(res);
    expect(out.status).toBe(200);
    expect(await out.text()).toBe("ok");
  });
});
