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
  if (path.length === 0 || path[0] === "auth") return { status: 404, message: "Não encontrado." };
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
