import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  GET: vi.fn(),
  PATCH: vi.fn(),
  tokens: [] as (string | undefined)[],
}));

vi.mock("@/lib/api/client", () => ({
  createApiClient: (token?: string) => {
    h.tokens.push(token);
    return { GET: h.GET, PATCH: h.PATCH };
  },
}));

import { getMe, updateMe } from "./users";

beforeEach(() => {
  h.GET.mockReset();
  h.PATCH.mockReset();
  h.tokens.length = 0;
});

const user = {
  id: "u1",
  supabaseId: "s1",
  email: "c@example.com",
  fullName: "Jane",
  phone: "+84901234567",
  locale: "en",
  role: "CUSTOMER",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("getMe", () => {
  it("GETs /api/v1/users/me with the token and returns the user", async () => {
    h.GET.mockResolvedValue({ data: user });
    const res = await getMe("tok");
    expect(res.email).toBe("c@example.com");
    expect(h.GET).toHaveBeenCalledWith("/api/v1/users/me");
    expect(h.tokens).toContain("tok");
  });
  it("propagates a thrown ApiError (e.g. USER_NOT_SYNCED) from the middleware", async () => {
    const { ApiError } = await import("./errors");
    h.GET.mockRejectedValue(new ApiError("USER_NOT_SYNCED", "not synced", 401));
    await expect(getMe("tok")).rejects.toMatchObject({ name: "ApiError", code: "USER_NOT_SYNCED" });
  });
  it("throws ApiError(EMPTY) when data is missing", async () => {
    h.GET.mockResolvedValue({ data: undefined });
    await expect(getMe("tok")).rejects.toMatchObject({ name: "ApiError", code: "EMPTY" });
  });
});

describe("updateMe", () => {
  it("PATCHes /api/v1/users/me with the body and returns the updated user", async () => {
    h.PATCH.mockResolvedValue({ data: { ...user, fullName: "Janet" } });
    const res = await updateMe("tok", { fullName: "Janet" });
    expect(res.fullName).toBe("Janet");
    expect(h.PATCH).toHaveBeenCalledWith("/api/v1/users/me", { body: { fullName: "Janet" } });
  });
});
