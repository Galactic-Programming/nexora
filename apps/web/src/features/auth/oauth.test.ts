import { describe, it, expect } from "vitest";
import { buildOAuthRedirect } from "./oauth";

describe("buildOAuthRedirect", () => {
  it("builds the callback URL with locale + returnTo as an encoded next", () => {
    expect(buildOAuthRedirect("http://localhost:3001", "en", "/account")).toBe(
      "http://localhost:3001/auth/callback?next=%2Fen%2Faccount",
    );
  });
  it("collapses a root returnTo to just the locale (no trailing slash)", () => {
    expect(buildOAuthRedirect("http://localhost:3001", "vi", "/")).toBe(
      "http://localhost:3001/auth/callback?next=%2Fvi",
    );
  });
  it("encodes query/hash characters in returnTo exactly once", () => {
    expect(buildOAuthRedirect("http://localhost:3001", "en", "/tours?x=1")).toBe(
      "http://localhost:3001/auth/callback?next=%2Fen%2Ftours%3Fx%3D1",
    );
  });
});
