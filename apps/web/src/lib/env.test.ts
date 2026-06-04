import { describe, it, expect } from "vitest";
import { parseEnv, type Env } from "./env";

const valid = {
  NEXT_PUBLIC_API_BASE_URL: "http://localhost:3000/api/v1",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("parseEnv", () => {
  it("returns typed env when all vars are present and valid", () => {
    const result: Env = parseEnv(valid);
    expect(result).toEqual(valid);
    expect(result.NEXT_PUBLIC_API_BASE_URL).toBe(valid.NEXT_PUBLIC_API_BASE_URL);
  });

  it("throws listing the missing variable names", () => {
    const { NEXT_PUBLIC_SUPABASE_URL: _omit, ...partial } = valid;
    expect(() => parseEnv(partial)).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("throws when API base URL is not a valid URL", () => {
    expect(() => parseEnv({ ...valid, NEXT_PUBLIC_API_BASE_URL: "not-a-url" })).toThrowError(
      /NEXT_PUBLIC_API_BASE_URL/,
    );
  });
});
