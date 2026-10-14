import "server-only";
import createClient from "openapi-fetch";
import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth/session";
import { env } from "@/lib/env";
import type { paths } from "./schema";

/** Where a request with an invalid or expired token sends the user (clears the cookie, then login). */
export const SESSION_EXPIRED_PATH = "/auth/session-expired";

/** Typed client for the MaiaFlow API. Only ever used on the server: the token never reaches the browser. */
export function createApiClient(token?: string) {
  return createClient<paths>({
    baseUrl: env.API_URL,
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

/** Client for signed-in requests. Redirects to the login page when there is no usable session. */
export async function getAuthedApi() {
  const token = await getSessionToken();
  if (!token) redirect(SESSION_EXPIRED_PATH);
  return createApiClient(token);
}

/** The API rejected the request; carries the HTTP status and the ProblemDetails body. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiResult<T> = { data?: T; error?: unknown; response: Response };

/**
 * Returns the data of an API call or throws. A 401 means the session is gone, so it redirects to the
 * page that clears the cookie and asks the user to sign in again.
 */
export function unwrap<T>(result: ApiResult<T>): T {
  if (result.response.status === 401) redirect(SESSION_EXPIRED_PATH);
  if (result.error !== undefined || result.data === undefined) {
    throw new ApiError(
      result.response.status,
      result.error,
      `API request failed with status ${result.response.status}`,
    );
  }
  return result.data;
}
