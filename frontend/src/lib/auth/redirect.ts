/** Placeholder origin used only to parse a relative path the way a browser would. */
const PARSE_BASE = "http://same-site.invalid";

/**
 * Only same-site paths are valid redirect targets after login. Anything else (another host, `//host`,
 * backslash tricks, control characters that URL parsing strips, e.g. `/\t/host`) falls back to the
 * home page, so a crafted `?next=` cannot send users elsewhere.
 */
export function safeRedirectPath(
  target: string | null | undefined,
  fallback: string = "/",
): string {
  if (!target) return fallback;
  if (!target.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(target)) return fallback;

  const url = new URL(target, PARSE_BASE);
  if (url.origin !== PARSE_BASE || url.pathname.startsWith("//")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
