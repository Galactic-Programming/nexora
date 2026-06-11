import { describe, it, expect } from "vitest";
import { profileSchema } from "./schema";

describe("profileSchema", () => {
  it("accepts valid values", () => {
    const r = profileSchema.safeParse({ fullName: "Jane Doe", phone: "+84901234567", locale: "en" });
    expect(r.success).toBe(true);
  });
  it("accepts empty optional strings (cleared in the form, omitted later by the body-builder)", () => {
    const r = profileSchema.safeParse({ fullName: "", phone: "", locale: "vi" });
    expect(r.success).toBe(true);
  });
  it("rejects fullName longer than 120 chars", () => {
    const r = profileSchema.safeParse({ fullName: "x".repeat(121), phone: "", locale: "en" });
    expect(r.success).toBe(false);
  });
  it("rejects a non-empty phone shorter than 6 chars", () => {
    const r = profileSchema.safeParse({ fullName: "", phone: "12345", locale: "en" });
    expect(r.success).toBe(false);
  });
  it("rejects a phone longer than 20 chars", () => {
    const r = profileSchema.safeParse({ fullName: "", phone: "1".repeat(21), locale: "en" });
    expect(r.success).toBe(false);
  });
  it("rejects an invalid locale", () => {
    const r = profileSchema.safeParse({ fullName: "", phone: "", locale: "fr" });
    expect(r.success).toBe(false);
  });
});
