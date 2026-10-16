import "server-only";
import createClient from "openapi-fetch";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth/session";
import { env } from "@/lib/env";
import type { paths } from "./schema";

/** Where a request with an invalid or expired token sends the user (clears the cookie, then login). */
export const SESSION_EXPIRED_PATH = "/auth/session-expired";

/** Typed client for the MaiaFlow API. Only ever used on the server: the token never reaches the browser. */
export function createApiClient(token?: string, extraHeaders: Record<string, string> = {}) {
  return createClient<paths>({
    baseUrl: env.API_URL,
    cache: "no-store",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders },
  });
}

/** Only addresses (IPv4, IPv6, commas, spaces): anything else in the header is dropped, not forwarded. */
const FORWARDED_FOR_PATTERN = /^[0-9a-fA-F:., ]{1,200}$/;

/**
 * Client for the anonymous calls (sign-in, sign-up). When `FORWARD_CLIENT_IP` is on, the visitor's
 * address is passed to the API in `X-Forwarded-For` so its per-client rate limit tells visitors apart;
 * otherwise every visitor would share the web server's address.
 */
export async function getPublicApi() {
  if (!env.FORWARD_CLIENT_IP) return createApiClient();

  const forwardedFor = (await headers()).get("x-forwarded-for");
  return createApiClient(
    undefined,
    forwardedFor && FORWARDED_FOR_PATTERN.test(forwardedFor)
      ? { "X-Forwarded-For": forwardedFor }
      : {},
  );
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
