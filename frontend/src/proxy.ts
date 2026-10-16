import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { isTokenUsable } from "@/lib/auth/jwt";
import { buildContentSecurityPolicy, generateNonce } from "@/lib/security/csp";

const AUTH_PAGES = ["/login", "/signup"];

/**
 * Optimistic check only: it looks at the cookie, never at the API. A valid-looking token that the API
 * rejects is handled where the API is called (a 401 sends the user through /auth/session-expired).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = isTokenUsable(request.cookies.get(SESSION_COOKIE)?.value);
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (!signedIn && !isAuthPage) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (signedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return nextWithCsp(request);
}

/**
 * Lets the request through with a Content-Security-Policy. The nonce travels in the request headers
 * so Next.js can stamp it on the scripts it renders, and the `x-nonce` copy lets the root layout hand it
 * to the theme script.
 */
function nextWithCsp(request: NextRequest) {
  const nonce = generateNonce();
  const policy = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", policy);
  return response;
}

export const config = {
  // Static assets, the BFF (it answers 401 itself) and the route that clears a dead session stay out.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|auth/).*)"],
};
