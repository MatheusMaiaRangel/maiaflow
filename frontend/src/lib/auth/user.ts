import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ApiError, getAuthedApi, SESSION_EXPIRED_PATH, unwrap } from "@/lib/api/client";

export type CurrentUser = { name: string; email: string };

/**
 * The signed-in user. Cached per request, so the layout and pages can both call it for one API call.
 * A user that no longer exists (deleted account, token still valid) is treated as a dead session.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const api = await getAuthedApi();
  try {
    const user = unwrap(await api.GET("/api/users/me"));
    return { name: user.name, email: user.email };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) redirect(SESSION_EXPIRED_PATH);
    throw error;
  }
});
