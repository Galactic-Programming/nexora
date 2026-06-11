import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateMe: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getSession: h.getSession } }),
}));
vi.mock("@/lib/api/users", () => ({ updateMe: h.updateMe }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));

import { updateProfile } from "./actions";

const original = { fullName: "Jane", phone: "+84901234567", locale: "en" as const };
const validInput = { locale: "en", original, values: { fullName: "Janet", phone: "+84901234567", locale: "en" as const } };

beforeEach(() => {
  h.getSession.mockReset();
  h.updateMe.mockReset();
  h.revalidatePath.mockReset();
  h.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

describe("updateProfile", () => {
  it("returns NO_SESSION when there is no session", async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    expect(await updateProfile(validInput)).toEqual({ ok: false, error: "NO_SESSION" });
    expect(h.updateMe).not.toHaveBeenCalled();
  });
  it("returns VALIDATION for invalid values", async () => {
    const bad = { ...validInput, values: { fullName: "x".repeat(121), phone: "", locale: "en" as const } };
    expect(await updateProfile(bad)).toEqual({ ok: false, error: "VALIDATION" });
    expect(h.updateMe).not.toHaveBeenCalled();
  });
  it("no-ops (does not call updateMe) when nothing changed", async () => {
    const same = { ...validInput, values: { fullName: "Jane", phone: "+84901234567", locale: "en" as const } };
    expect(await updateProfile(same)).toEqual({ ok: true, noop: true });
    expect(h.updateMe).not.toHaveBeenCalled();
  });
  it("calls updateMe with the diffed body and revalidates on success", async () => {
    h.updateMe.mockResolvedValue({ ...original, fullName: "Janet" });
    expect(await updateProfile(validInput)).toEqual({ ok: true });
    expect(h.updateMe).toHaveBeenCalledWith("tok", { fullName: "Janet" });
    expect(h.revalidatePath).toHaveBeenCalledWith("/en/account");
  });
  it("returns REQUEST_FAILED when updateMe throws", async () => {
    h.updateMe.mockRejectedValue(new Error("boom"));
    expect(await updateProfile(validInput)).toEqual({ ok: false, error: "REQUEST_FAILED" });
  });
  it("falls back to the default locale when an unknown locale segment is supplied", async () => {
    h.updateMe.mockResolvedValue({ ...original, fullName: "Janet" });
    const badLocale = { ...validInput, locale: "zz" };
    expect(await updateProfile(badLocale)).toEqual({ ok: true });
    expect(h.revalidatePath).toHaveBeenCalledWith("/en/account");
  });
});
