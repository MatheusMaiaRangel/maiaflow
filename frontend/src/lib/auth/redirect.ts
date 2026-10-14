/**
 * Only same-site paths are valid redirect targets after login. Anything else (another host, `//host`,
 * backslash tricks) falls back to the home page, so a crafted `?next=` cannot send users elsewhere.
 */
export function safeRedirectPath(
  target: string | null | undefined,
  fallback: string = "/",
): string {
  if (!target) return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) return fallback;
  return target;
}
