import { describe, it, expect } from "vitest";
import { mapAuthError } from "./auth-error";

describe("mapAuthError", () => {
  it("maps invalid credentials", () => {
    expect(mapAuthError({ message: "Invalid login credentials" })).toBe("errors.invalidCredentials");
  });
  it("maps unconfirmed email", () => {
    expect(mapAuthError({ message: "Email not confirmed" })).toBe("errors.emailNotConfirmed");
  });
  it("maps already-registered", () => {
    expect(mapAuthError({ message: "User already registered" })).toBe("errors.emailTaken");
  });
  it("maps rate limiting", () => {
    expect(mapAuthError({ message: "For security purposes, you can only request this after 30 seconds" })).toBe("errors.rateLimited");
  });
  it("maps an expired/invalid link", () => {
    expect(mapAuthError({ message: "Token has expired or is invalid" })).toBe("errors.linkInvalid");
  });
  it("falls back to a generic key", () => {
    expect(mapAuthError({ message: "some unknown thing" })).toBe("errors.generic");
    expect(mapAuthError(null)).toBe("errors.generic");
  });
});
