// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { API_URL: "http://api.test" } }));

import { GET } from "./route";

function jwt(expOffsetSeconds = 3600): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode({ exp: Math.floor(Date.now() / 1000) + expOffsetSeconds })}.sig`;
}

function call(token?: string) {
  return GET(
    new NextRequest("http://localhost:3000/auth/session-expired", {
      headers: token ? { cookie: `maiaflow_token=${token}` } : {},
    }),
  );
}

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const clearsCookie = (response: Response) =>
  response.headers.get("set-cookie")?.includes("maiaflow_token=;") ?? false;

describe("GET /auth/session-expired", () => {
  it("clears the cookie and goes to login when there is no usable token", async () => {
    for (const token of [undefined, "garbage", jwt(-60)]) {
      const response = await call(token);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/login?reason=expired");
      expect(clearsCookie(response)).toBe(true);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 404])("clears the cookie when the API answers %i for the token", async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));

    const response = await call(jwt());

    expect(response.headers.get("location")).toBe("http://localhost:3000/login?reason=expired");
    expect(clearsCookie(response)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/api/users/me");
    expect(new Headers(init.headers).get("authorization")).toMatch(/^Bearer /);
  });

  it("keeps a session the API still accepts, so a link from another site cannot sign anyone out", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const response = await call(jwt());

    expect(response.headers.get("location")).toBe("http://localhost:3000/");
    expect(clearsCookie(response)).toBe(false);
  });

  it("keeps the cookie when the API cannot be reached or fails", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const unreachable = await call(jwt());
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    const failing = await call(jwt());

    for (const response of [unreachable, failing]) {
      expect(response.headers.get("location")).toBe("http://localhost:3000/");
      expect(clearsCookie(response)).toBe(false);
    }
  });
});
