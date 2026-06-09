import { describe, it, expect } from "vitest";
import { signInSchema, signUpSchema, forgotSchema, resetSchema } from "./schemas";

describe("signInSchema", () => {
  it("accepts a valid email + password", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "secret12" }).success).toBe(true);
  });
  it("rejects an invalid email", () => {
    const r = signInSchema.safeParse({ email: "nope", password: "secret12" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("validation.emailInvalid");
  });
  it("rejects a short password", () => {
    const r = signInSchema.safeParse({ email: "a@b.com", password: "x" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("validation.passwordMin");
  });
});

describe("signUpSchema", () => {
  it("accepts matching passwords", () => {
    expect(signUpSchema.safeParse({ email: "a@b.com", password: "secret12", confirmPassword: "secret12" }).success).toBe(true);
  });
  it("rejects mismatched confirmPassword on the confirm field", () => {
    const r = signUpSchema.safeParse({ email: "a@b.com", password: "secret12", confirmPassword: "nope1234" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path[0] === "confirmPassword");
      expect(issue?.message).toBe("validation.passwordMismatch");
    }
  });
});

describe("forgotSchema / resetSchema", () => {
  it("forgot accepts an email", () => {
    expect(forgotSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });
  it("reset requires matching passwords", () => {
    expect(resetSchema.safeParse({ password: "secret12", confirmPassword: "secret12" }).success).toBe(true);
    expect(resetSchema.safeParse({ password: "secret12", confirmPassword: "x" }).success).toBe(false);
  });
});
