import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { isTokenUsable } from "@/lib/auth/jwt";
import { env } from "@/lib/env";

/** How long to wait for the API before giving up on the check below. */
const API_CHECK_TIMEOUT_MS = 5000;

/** The statuses `GET /api/users/me` uses for "this token is no good": rejected, or its user is gone. */
const DEAD_SESSION_STATUSES = new Set([401, 404]);

/** Asks the API whether it still accepts the token. Unknown (network error, 5xx) counts as "yes". */
async function isSessionDead(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${env.API_URL}/api/users/me`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(API_CHECK_TIMEOUT_MS),
    });
    return DEAD_SESSION_STATUSES.has(response.status);
  } catch {
    return false;
  }
}

/**
 * The app found out the token is no good: drop the cookie and ask the user to sign in again.
 *
 * Anyone can point a link or an image at this URL, so it must not log people out on request: with a
 * token that looks usable it first checks with the API, and only clears the cookie when the API
 * confirms the session is dead. Otherwise it just sends the user home.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (isTokenUsable(token) && !(await isSessionDead(token!))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.redirect(new URL("/login?reason=expired", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
