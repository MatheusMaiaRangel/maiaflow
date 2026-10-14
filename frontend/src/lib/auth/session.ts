import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./constants";
import { getTokenExpiry, isTokenUsable } from "./jwt";

/** Stores the API's JWT in an httpOnly cookie that lives as long as the token. */
export async function createSession(token: string): Promise<void> {
  const exp = getTokenExpiry(token);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(exp ? { expires: new Date(exp * 1000) } : {}),
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The JWT of the signed-in user, or undefined when there is none or it already expired. */
export async function getSessionToken(): Promise<string | undefined> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return isTokenUsable(token) ? token : undefined;
}
