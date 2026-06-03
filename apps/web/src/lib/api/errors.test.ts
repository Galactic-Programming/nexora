import { describe, it, expect } from "vitest";
import { ApiError } from "./errors";

describe("ApiError", () => {
  it("carries code, message and status", () => {
    const err = new ApiError("TOUR_NOT_FOUND", "Tour not found", 404);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(err.code).toBe("TOUR_NOT_FOUND");
    expect(err.message).toBe("Tour not found");
    expect(err.status).toBe(404);
  });

  it("is identifiable via the static isApiError guard", () => {
    expect(ApiError.isApiError(new ApiError("X", "y", 500))).toBe(true);
    expect(ApiError.isApiError(new Error("plain"))).toBe(false);
  });
});
