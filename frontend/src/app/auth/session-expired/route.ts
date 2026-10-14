import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/** The API said the token is no good: drop the cookie and ask the user to sign in again. */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login?reason=expired", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
