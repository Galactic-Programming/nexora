import { describe, it, expect } from "vitest";
import { shouldChallengeMfa, pickTotpFactor } from "./mfa";

describe("shouldChallengeMfa", () => {
  it("is true when the session must step up to aal2", () => {
    expect(shouldChallengeMfa({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
  });
  it("is false when already aal2", () => {
    expect(shouldChallengeMfa({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
  });
  it("is false when no factor is enrolled (next stays aal1)", () => {
    expect(shouldChallengeMfa({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
  });
  it("is false for null/missing input", () => {
    expect(shouldChallengeMfa(null)).toBe(false);
    expect(shouldChallengeMfa({ currentLevel: null, nextLevel: null })).toBe(false);
  });
});

describe("pickTotpFactor", () => {
  const verified = { id: "f1", status: "verified" };
  const unverified = { id: "f2", status: "unverified" };
  it("picks the first verified totp factor", () => {
    expect(pickTotpFactor({ totp: [unverified, verified] })).toEqual(verified);
  });
  it("returns null when no verified factor exists", () => {
    expect(pickTotpFactor({ totp: [unverified] })).toBe(null);
    expect(pickTotpFactor({ totp: [] })).toBe(null);
    expect(pickTotpFactor({})).toBe(null);
    expect(pickTotpFactor(null)).toBe(null);
  });
});
