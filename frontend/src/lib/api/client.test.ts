// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionToken = vi.fn();

vi.mock("@/lib/env", () => ({ env: { API_URL: "http://api.test" } }));
vi.mock("@/lib/auth/session", () => ({ getSessionToken: () => getSessionToken() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

import { ApiError, createApiClient, getAuthedApi, SESSION_EXPIRED_PATH, unwrap } from "./client";

const result = (status: number, data?: unknown, error?: unknown) => ({
  data,
  error,
  response: { status } as Response,
});

beforeEach(() => getSessionToken.mockReset());

describe("unwrap", () => {
  it("returns the data of a successful call", () => {
    expect(unwrap(result(200, { id: 1 }))).toEqual({ id: 1 });
  });

  it("sends the user through the session-expired page on 401", () => {
    expect(() => unwrap(result(401, undefined, {}))).toThrow(
      `NEXT_REDIRECT:${SESSION_EXPIRED_PATH}`,
    );
  });

  it("throws an ApiError carrying the status and problem body", () => {
    const problem = { detail: "Tarefa não encontrada." };

    try {
      unwrap(result(404, undefined, problem));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
      expect((error as ApiError).problem).toBe(problem);
    }
  });

  it("throws when a successful response has no data", () => {
    expect(() => unwrap(result(200))).toThrow(ApiError);
  });
});

describe("getAuthedApi", () => {
  it("redirects when there is no usable session", async () => {
    getSessionToken.mockResolvedValue(undefined);

    await expect(getAuthedApi()).rejects.toThrow(`NEXT_REDIRECT:${SESSION_EXPIRED_PATH}`);
  });

  it("returns a client when there is a session", async () => {
    getSessionToken.mockResolvedValue("jwt");

    expect(await getAuthedApi()).toHaveProperty("GET");
  });
});

describe("createApiClient", () => {
  it("sends the bearer token on every request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await createApiClient("jwt").GET("/api/tasks");

    const request = fetchMock.mock.calls[0]![0] as Request;
    expect(request.url).toBe("http://api.test/api/tasks");
    expect(request.headers.get("authorization")).toBe("Bearer jwt");
    vi.unstubAllGlobals();
  });
});
