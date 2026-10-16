/** A fresh, unguessable value for every request: it lets the scripts Next.js renders run under the CSP. */
export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/**
 * Content-Security-Policy for pages. Scripts need the per-request nonce (`strict-dynamic` lets those
 * scripts load their own chunks); everything else is limited to the app's own origin, which is enough
 * because the browser only talks to this app (the BFF), never to the API or third parties.
 *
 * Styles allow inline attributes: the UI primitives position popovers with `style=""`, and CSS injection
 * is a far smaller risk than script injection. `unsafe-eval` is only added in development (React uses
 * eval for debugging information there).
 */
export function buildContentSecurityPolicy(nonce: string, isDevelopment: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}
