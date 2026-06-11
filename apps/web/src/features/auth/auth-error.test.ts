import { describe, it, expect } from "vitest";
import { mapAuthError, mapCallbackError, callbackErrorFlag } from "./auth-error";

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

describe("callbackErrorFlag", () => {
  it("classifies an expired email OTP link as a link error", () => {
    expect(callbackErrorFlag("otp_expired")).toBe("link");
  });
  it("classifies everything else (provider error / cancel / unknown) as oauth", () => {
    expect(callbackErrorFlag("user_cancelled")).toBe("oauth");
    expect(callbackErrorFlag("access_denied")).toBe("oauth");
    expect(callbackErrorFlag(null)).toBe("oauth");
  });
});

describe("mapCallbackError", () => {
  it("maps known callback flags to i18n keys", () => {
    expect(mapCallbackError("link")).toBe("errors.linkInvalid");
    expect(mapCallbackError("oauth")).toBe("errors.oauthFailed");
  });
  it("returns null for unknown or absent flags", () => {
    expect(mapCallbackError("weird")).toBe(null);
    expect(mapCallbackError("")).toBe(null);
    expect(mapCallbackError(null)).toBe(null);
  });
});
