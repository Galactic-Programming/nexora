import { createApiClient } from "./client";
import { ApiError } from "./errors";
import type { components } from "./schema";

export type User = components["schemas"]["UserDto"];
export type UpdateMeBody = components["schemas"]["UpdateMeDto"];

/**
 * Fetches the signed-in user's profile. Uses the typed client whose envelope
 * middleware throws ApiError on an error envelope — so a backend 401
 * `USER_NOT_SYNCED` surfaces here as `ApiError` with `code === "USER_NOT_SYNCED"`.
 */
export async function getMe(token: string): Promise<User> {
  const { data } = await createApiClient(token).GET("/api/v1/users/me");
  if (!data) throw new ApiError("EMPTY", "Empty /users/me response", 200);
  return data;
}

/** Partial-updates the signed-in user's profile (fullName / phone / locale). */
export async function updateMe(token: string, body: UpdateMeBody): Promise<User> {
  const { data } = await createApiClient(token).PATCH("/api/v1/users/me", { body });
  if (!data) throw new ApiError("EMPTY", "Empty /users/me PATCH response", 200);
  return data;
}
