import createClient from "openapi-fetch";
import { GENERIC_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE, problemMessage } from "./problem";
import type { paths } from "./schema";

/** Where a 401 sends the user (clears the cookie, then login). Same page the server side uses. */
const SESSION_EXPIRED_PATH = "/auth/session-expired";

/** The API (through the BFF) rejected a request; carries the status and the ProblemDetails body. */
export class ClientApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: unknown,
  ) {
    super(problemMessage(problem));
    this.name = "ClientApiError";
  }
}

let client: ReturnType<typeof createClient<paths>> | undefined;

/**
 * Typed client for browser code. It calls the same-origin BFF (`/api/...`), which adds the token from
 * the httpOnly cookie, so no credentials are handled here.
 */
export function getBrowserApi() {
  client ??= createClient<paths>({
    baseUrl: window.location.origin,
    headers: { Accept: "application/json" },
  });
  return client;
}

type ApiResult<T> = { data?: T; error?: unknown; response: Response };

function failIfNeeded(result: { error?: unknown; response: Response }): void {
  const { response, error } = result;
  if (response.status === 401) {
    // A full navigation on purpose: that route handler clears the cookie before showing the login page.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(SESSION_EXPIRED_PATH);
    throw new ClientApiError(401, error);
  }
  if (!response.ok) throw new ClientApiError(response.status, error);
}

/** Data of a successful call; throws {@link ClientApiError} otherwise. */
export function apiData<T>(result: ApiResult<T>): T {
  failIfNeeded(result);
  if (result.data === undefined) throw new ClientApiError(result.response.status, result.error);
  return result.data;
}

/** For calls with no body in the answer (204); throws {@link ClientApiError} on failure. */
export function apiDone(result: { error?: unknown; response: Response }): void {
  failIfNeeded(result);
}

/** Portuguese text to show the user for anything a mutation or query may throw. */
export function errorMessage(error: unknown, fallback: string = GENERIC_ERROR_MESSAGE): string {
  if (error instanceof ClientApiError) return problemMessage(error.problem, fallback);
  if (error instanceof TypeError) return NETWORK_ERROR_MESSAGE;
  return fallback;
}
