import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkBffRequest, MAX_BODY_BYTES } from "@/lib/api/bff";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { env } from "@/lib/env";

type Context = { params: Promise<{ path: string[] }> };

function problem(status: number, detail: string) {
  return NextResponse.json(
    { status, title: detail, detail },
    {
      status,
      headers: { "content-type": "application/problem+json" },
    },
  );
}

/**
 * Backend-for-frontend: the browser calls same-origin `/api/...`, this handler adds the JWT from the
 * httpOnly cookie and forwards to the API. The token never reaches client-side JavaScript.
 */
async function forward(request: NextRequest, { params }: Context) {
  const { path } = await params;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const hasBody = !["GET", "HEAD"].includes(request.method);

  const rejection = checkBffRequest({
    method: request.method,
    path,
    origin: request.headers.get("origin"),
    expectedOrigin: request.nextUrl.origin,
    contentLength: Number(request.headers.get("content-length")) || null,
    token,
  });
  if (rejection) {
    const response = problem(rejection.status, rejection.message);
    if (rejection.status === 401) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  const body = hasBody ? await request.arrayBuffer() : undefined;
  if (body && body.byteLength > MAX_BODY_BYTES) return problem(413, "Requisição muito grande.");

  const target = `${env.API_URL}/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers = new Headers({ authorization: `Bearer ${token}` });
  for (const name of ["accept", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return problem(502, "Não foi possível conectar ao servidor. Tente novamente.");
  }

  const response = new NextResponse(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
  const location = upstream.headers.get("location");
  if (location) response.headers.set("location", new URL(location, target).pathname);
  if (upstream.status === 401) response.cookies.delete(SESSION_COOKIE);
  return response;
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };
