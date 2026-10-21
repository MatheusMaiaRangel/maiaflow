// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { API_URL: "http://api.test" } }));

import { DELETE, GET, PATCH, POST, PUT } from "./route";

function jwt(expOffsetSeconds = 3600): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode({ exp: Math.floor(Date.now() / 1000) + expOffsetSeconds })}.sig`;
}

function request(
  path: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    token?: string | null;
  } = {},
) {
  const { token = jwt(), headers = {}, ...rest } = init;
  return new NextRequest(`http://localhost:3000/api/${path}`, {
    ...rest,
    headers: { ...(token ? { cookie: `maiaflow_token=${token}` } : {}), ...headers },
  });
}

const context = (path: string) => ({ params: Promise.resolve({ path: path.split("/") }) });

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("BFF proxy", () => {
  it("forwards a GET with the token from the cookie, not from the browser", async () => {
    const token = jwt();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 1 }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await GET(
      request("tasks?status=Pending", { token, headers: { authorization: "Bearer attacker" } }),
      context("tasks"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: 1 }]);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/api/tasks?status=Pending");
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${token}`);
    expect(new Headers(init.headers).has("cookie")).toBe(false);
  });

  it("forwards the JSON body of a same-origin POST and rewrites Location to a path", async () => {
    fetchMock.mockResolvedValue(
      new Response("{}", {
        status: 201,
        headers: { "content-type": "application/json", location: "http://api.test/api/tasks/7" },
      }),
    );

    const response = await POST(
      request("tasks", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({ title: "Nova" }),
      }),
      context("tasks"),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe("/api/tasks/7");
    const init = fetchMock.mock.calls[0]![1];
    expect(init.method).toBe("POST");
    expect(Buffer.from(init.body).toString()).toBe('{"title":"Nova"}');
  });

  it("forwards a same-origin PUT (the dashboard is saved whole) and refuses one from another origin", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const saved = await PUT(
      request("dashboard", {
        method: "PUT",
        headers: { origin: "http://localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({ revision: 0 }),
      }),
      context("dashboard"),
    );
    const foreign = await PUT(
      request("dashboard", { method: "PUT", headers: { origin: "https://evil.test" }, body: "{}" }),
      context("dashboard"),
    );

    expect(saved.status).toBe(200);
    expect(fetchMock.mock.calls[0]![1].method).toBe("PUT");
    expect(foreign.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes 204 through without a body", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await DELETE(
      request("tasks/7", { method: "DELETE", headers: { origin: "http://localhost:3000" } }),
      context("tasks/7"),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("clears the cookie when the API answers 401", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));

    const response = await GET(request("tasks"), context("tasks"));

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain("maiaflow_token=;");
  });

  it("answers 401 and clears the cookie without calling the API when there is no usable token", async () => {
    const response = await GET(request("tasks", { token: null }), context("tasks"));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses state-changing calls from another origin", async () => {
    const response = await PATCH(
      request("tasks/1", {
        method: "PATCH",
        headers: { origin: "http://evil.example" },
        body: "{}",
      }),
      context("tasks/1"),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not expose the auth routes", async () => {
    const response = await POST(
      request("auth/login", { method: "POST", headers: { origin: "http://localhost:3000" } }),
      context("auth/login"),
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects bodies over the limit", async () => {
    const response = await POST(
      request("tasks", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "content-type": "application/json" },
        body: "x".repeat(64 * 1024 + 1),
      }),
      context("tasks"),
    );

    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 502 when the API is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const response = await GET(request("tasks"), context("tasks"));

    expect(response.status).toBe(502);
    expect((await response.json()).detail).toContain("Não foi possível conectar");
  });
});
