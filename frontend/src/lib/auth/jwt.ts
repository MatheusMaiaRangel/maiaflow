/**
 * Reads the expiry (`exp`, in seconds since the epoch) of a JWT without verifying it.
 *
 * The frontend has no signing key and does not need one: the API validates the token on every call.
 * This is only used for cheap, optimistic decisions (cookie lifetime, redirecting to login early).
 */
export function getTokenExpiry(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), (c) =>
        c.charCodeAt(0),
      ),
    );
    const { exp } = JSON.parse(json) as { exp?: unknown };
    return typeof exp === "number" && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

/** True when the token has an expiry in the future. A token we cannot read counts as expired. */
export function isTokenUsable(token: string | undefined, nowMs: number = Date.now()): boolean {
  if (!token) return false;
  const exp = getTokenExpiry(token);
  return exp !== null && exp * 1000 > nowMs;
}
