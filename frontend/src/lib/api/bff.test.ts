import { describe, expect, it } from "vitest";
import { checkBffRequest, MAX_BODY_BYTES } from "./bff";

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
