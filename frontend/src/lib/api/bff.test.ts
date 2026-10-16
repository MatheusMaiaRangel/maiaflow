import { describe, expect, it } from "vitest";
import { checkBffRequest, MAX_BODY_BYTES, readBodyWithLimit, resolveExpectedOrigin } from "./bff";

function validToken(): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

const base = {
  method: "GET",
  path: ["tasks"],
  origin: null,
  expectedOrigin: "http://localhost:3000",
  contentLength: null,
  token: validToken(),
};

describe("checkBffRequest", () => {
  it("lets an authenticated GET through", () => {
    expect(checkBffRequest(base)).toBeNull();
  });

  it("blocks the auth routes so the token never reaches the browser", () => {
    expect(checkBffRequest({ ...base, path: ["auth", "login"] })?.status).toBe(404);
    // The API's routing ignores case, so "Auth" must not slip through.
    expect(checkBffRequest({ ...base, path: ["Auth", "login"] })?.status).toBe(404);
    expect(checkBffRequest({ ...base, path: ["AUTH", "login"] })?.status).toBe(404);
    expect(checkBffRequest({ ...base, path: [] })?.status).toBe(404);
  });

  it("rejects path traversal", () => {
    expect(checkBffRequest({ ...base, path: ["tasks", ".."] })?.status).toBe(400);
    expect(checkBffRequest({ ...base, path: ["a/b"] })?.status).toBe(400);
  });

  it("answers 401 without a usable token", () => {
    expect(checkBffRequest({ ...base, token: undefined })?.status).toBe(401);
    expect(checkBffRequest({ ...base, token: "garbage" })?.status).toBe(401);
  });

  it("requires a same-origin Origin header for state-changing methods", () => {
    const post = { ...base, method: "POST", origin: "http://localhost:3000" };
    expect(checkBffRequest(post)).toBeNull();
    expect(checkBffRequest({ ...post, origin: "http://evil.example" })?.status).toBe(403);
    expect(checkBffRequest({ ...post, origin: null })?.status).toBe(403);
  });

  it("rejects oversized bodies", () => {
    const post = { ...base, method: "PATCH", origin: base.expectedOrigin };
    expect(checkBffRequest({ ...post, contentLength: MAX_BODY_BYTES + 1 })?.status).toBe(413);
    expect(checkBffRequest({ ...post, contentLength: MAX_BODY_BYTES })).toBeNull();
  });
});

describe("resolveExpectedOrigin", () => {
  const request = {
    forwardedHost: null,
    forwardedProto: null,
    requestOrigin: "http://0.0.0.0:3000",
  };

  it("prefers the configured public origin", () => {
    expect(
      resolveExpectedOrigin({
        ...request,
        appOrigin: "https://app.example.com",
        forwardedHost: "x.test",
      }),
    ).toBe("https://app.example.com");
  });

  it("uses the proxy's forwarded host and protocol", () => {
    expect(
      resolveExpectedOrigin({
        ...request,
        appOrigin: undefined,
        forwardedHost: "app.example.com",
        forwardedProto: "https",
      }),
    ).toBe("https://app.example.com");
  });

  it("takes the first value of a comma-separated forwarded chain", () => {
    expect(
      resolveExpectedOrigin({
        ...request,
        appOrigin: undefined,
        forwardedHost: "app.example.com, internal:3000",
        forwardedProto: "https, http",
      }),
    ).toBe("https://app.example.com");
  });

  it("keeps the request protocol when the forwarded one is missing or unknown", () => {
    const base = { ...request, appOrigin: undefined, forwardedHost: "app.example.com:8080" };
    expect(
      resolveExpectedOrigin({
        ...base,
        requestOrigin: "http://localhost:3000",
        forwardedProto: null,
      }),
    ).toBe("http://app.example.com:8080");
    expect(
      resolveExpectedOrigin({
        ...base,
        requestOrigin: "https://localhost:3000",
        forwardedProto: "javascript",
      }),
    ).toBe("https://app.example.com:8080");
  });

  it("falls back to the request origin without a proxy or with a garbage host", () => {
    expect(resolveExpectedOrigin({ ...request, appOrigin: undefined })).toBe("http://0.0.0.0:3000");
    expect(
      resolveExpectedOrigin({ ...request, appOrigin: undefined, forwardedHost: "bad host/" }),
    ).toBe("http://0.0.0.0:3000");
  });
});

describe("readBodyWithLimit", () => {
  const streamOf = (...parts: string[]) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of parts) controller.enqueue(new TextEncoder().encode(part));
        controller.close();
      },
    });

  it("returns the whole body when it fits, across chunks", async () => {
    const body = await readBodyWithLimit(streamOf("hel", "lo"), 5);

    expect(new TextDecoder().decode(body!)).toBe("hello");
  });

  it("returns an empty body for a request without one", async () => {
    expect(await readBodyWithLimit(null, 10)).toEqual(new Uint8Array(0));
  });

  it("stops reading and returns null as soon as the limit is passed", async () => {
    let pulls = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(1024));
      },
    });

    expect(await readBodyWithLimit(endless, 4096)).toBeNull();
    expect(pulls).toBeLessThan(10);
  });
});
