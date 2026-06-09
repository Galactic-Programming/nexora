import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  POST: vi.fn(),
  tokens: [] as (string | undefined)[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getSession: h.getSession, signOut: h.signOut } }),
}));
vi.mock("@/lib/api/client", () => ({
  createApiClient: (token?: string) => {
    h.tokens.push(token);
    return { POST: h.POST };
  },
}));

import { syncUser, signOutAction } from "./actions";

beforeEach(() => {
  h.getSession.mockReset();
  h.signOut.mockReset();
  h.POST.mockReset();
  h.tokens.length = 0;
});

describe("syncUser", () => {
  it("returns ok:false NO_SESSION when there is no session", async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    expect(await syncUser()).toEqual({ ok: false, error: "NO_SESSION" });
    expect(h.POST).not.toHaveBeenCalled();
  });
  it("POSTs /api/v1/auth/sync with the access token and returns ok:true", async () => {
    h.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    h.POST.mockResolvedValue({ data: {}, error: undefined });
    expect(await syncUser()).toEqual({ ok: true });
    expect(h.POST).toHaveBeenCalledWith("/api/v1/auth/sync", { body: {} });
    expect(h.tokens).toContain("tok");
  });
  it("returns ok:false SYNC_FAILED when the API rejects", async () => {
    h.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    h.POST.mockRejectedValue(new Error("boom"));
    expect(await syncUser()).toEqual({ ok: false, error: "SYNC_FAILED" });
  });
});

describe("signOutAction", () => {
  it("calls supabase signOut", async () => {
    h.signOut.mockResolvedValue({ error: null });
    await signOutAction();
    expect(h.signOut).toHaveBeenCalled();
  });
});
