import { isTokenUsable } from "@/lib/auth/jwt";

/** Largest request body the BFF forwards. The API enforces the same limit. */
export const MAX_BODY_BYTES = 64 * 1024;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export type BffRejection = { status: number; message: string };

/**
 * Rules the browser-facing proxy applies before forwarding anything to the API. Pure function so it
 * can be tested without a server. Returns a rejection, or null when the request may go through.
 */
export function checkBffRequest(input: {
  method: string;
  path: string[];
  origin: string | null;
  expectedOrigin: string;
  contentLength: number | null;
  token: string | undefined;
}): BffRejection | null {
  const { method, path, origin, expectedOrigin, contentLength, token } = input;

  // Sign-in and sign-up go through Server Actions: the token must never be returned to the browser.
  if (path.length === 0 || path[0].toLowerCase() === "auth")
    return { status: 404, message: "Não encontrado." };
  if (path.some((segment) => segment === "." || segment === ".." || /[/\\]/.test(segment))) {
    return { status: 400, message: "Requisição inválida." };
  }
  if (!isTokenUsable(token)) return { status: 401, message: "Sessão expirada." };

  if (!SAFE_METHODS.has(method)) {
    // Cookies are SameSite=Lax; this closes the remaining cross-site gaps for state-changing calls.
    if (origin !== expectedOrigin) return { status: 403, message: "Origem não permitida." };
    if (contentLength !== null && contentLength > MAX_BODY_BYTES) {
      return { status: 413, message: "Requisição muito grande." };
    }
  }
  return null;
}

/**
 * The origin browsers see for this app, which the `Origin` header of state-changing calls must match.
 * Behind a reverse proxy the server's own URL can differ (internal host, plain http), so, in order:
 * the configured `APP_ORIGIN`, the proxy's `X-Forwarded-Host`/`-Proto`, then the request URL's origin.
 * A browser cannot forge those headers on a cross-site request (custom headers need a CORS preflight,
 * which the BFF never grants), so trusting them does not weaken the check.
 */
export function resolveExpectedOrigin(input: {
  appOrigin: string | undefined;
  forwardedHost: string | null;
  forwardedProto: string | null;
  requestOrigin: string;
}): string {
  const { appOrigin, forwardedHost, forwardedProto, requestOrigin } = input;
  if (appOrigin) return appOrigin;

  const host = forwardedHost?.split(",")[0]?.trim();
  if (!host) return requestOrigin;

  const proto = forwardedProto?.split(",")[0]?.trim().toLowerCase();
  const protocol =
    proto === "http" || proto === "https" ? proto : new URL(requestOrigin).protocol.slice(0, -1);
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return requestOrigin;
  }
}

/**
 * Reads a request body but gives up as soon as it passes `maxBytes`, so a client that omits
 * `Content-Length` (chunked) cannot make the server buffer an arbitrarily large body.
 * Returns null when the limit was exceeded.
 */
export async function readBodyWithLimit(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!stream) return new Uint8Array(0);

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
