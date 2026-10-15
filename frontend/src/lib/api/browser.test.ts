import { afterEach, describe, expect, test, vi } from "vitest";
import { apiData, apiDone, ClientApiError, errorMessage, getBrowserApi } from "./browser";

function response(status: number): Response {
  return new Response(null, { status });
}

afterEach(() => vi.unstubAllGlobals());

describe("apiData", () => {
  test("returns the data of a successful call", () => {
    expect(apiData({ data: { id: 1 }, response: response(200) })).toEqual({ id: 1 });
  });

  test("throws a ClientApiError carrying status and problem on failure", () => {
    const problem = { status: 400, detail: "Título inválido." };
    try {
      apiData({ error: problem, response: response(400) });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ClientApiError);
      expect((error as ClientApiError).status).toBe(400);
      expect((error as ClientApiError).message).toBe("Título inválido.");
    }
  });

  test("throws when a successful answer has no body", () => {
    expect(() => apiData({ response: response(200) })).toThrow(ClientApiError);
  });

  test("sends the user to the session-expired page on 401", () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });

    expect(() => apiData({ error: {}, response: response(401) })).toThrow(ClientApiError);
    expect(assign).toHaveBeenCalledWith("/auth/session-expired");
  });
});

describe("apiDone", () => {
  test("accepts an empty successful answer", () => {
    expect(() => apiDone({ response: response(204) })).not.toThrow();
  });

  test("throws on failure", () => {
    expect(() =>
      apiDone({ error: { detail: "Não encontrado." }, response: response(404) }),
    ).toThrow("Não encontrado.");
  });
});

describe("errorMessage", () => {
  test("uses the API's message", () => {
    const error = new ClientApiError(409, { detail: "E-mail já cadastrado." });
    expect(errorMessage(error)).toBe("E-mail já cadastrado.");
  });

  test("explains network failures", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toContain("conectar");
  });

  test("falls back for unknown errors", () => {
    expect(errorMessage(new Error("boom"))).toBe("Algo deu errado. Tente novamente.");
    expect(errorMessage(new Error("boom"), "Falhou.")).toBe("Falhou.");
  });
});

describe("getBrowserApi", () => {
  test("calls the same-origin API with typed paths", async () => {
    const fetchMock = vi.fn(
      async () => new Response("[]", { headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getBrowserApi().GET("/api/tasks", { fetch: fetchMock });

    expect(result.data).toEqual([]);
    const request = fetchMock.mock.calls[0] as unknown as [Request];
    expect(new URL(request[0].url).pathname).toBe("/api/tasks");
  });
});
