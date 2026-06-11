import { describe, it, expect } from "vitest";
import { buildUpdateBody } from "./build-update-body";

const original = { fullName: "Jane", phone: "+84901234567", locale: "en" as const };

describe("buildUpdateBody", () => {
  it("returns an empty object when nothing changed", () => {
    expect(buildUpdateBody(original, { fullName: "Jane", phone: "+84901234567", locale: "en" })).toEqual({});
  });
  it("includes only the changed fields", () => {
    expect(buildUpdateBody(original, { fullName: "Janet", phone: "+84901234567", locale: "en" })).toEqual({
      fullName: "Janet",
    });
  });
  it("includes a changed locale", () => {
    expect(buildUpdateBody(original, { fullName: "Jane", phone: "+84901234567", locale: "vi" })).toEqual({
      locale: "vi",
    });
  });
  it("omits an emptied optional field (cannot clear in C2)", () => {
    expect(buildUpdateBody(original, { fullName: "Jane", phone: "", locale: "en" })).toEqual({});
  });
  it("trims values before comparing and emitting", () => {
    expect(buildUpdateBody(original, { fullName: "  Janet  ", phone: "+84901234567", locale: "en" })).toEqual({
      fullName: "Janet",
    });
  });
  it("treats a null original (never set) as empty baseline", () => {
    const blank = { fullName: null, phone: null, locale: "en" as const };
    expect(buildUpdateBody(blank, { fullName: "New", phone: "", locale: "en" })).toEqual({ fullName: "New" });
  });
});
