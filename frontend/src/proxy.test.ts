// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function jwt(expOffsetSeconds: number): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode({ exp: Math.floor(Date.now() / 1000) + expOffsetSeconds })}.sig`;
}

function call(path: string, token?: string) {
  return proxy(
    new NextRequest(`http://localhost:3000${path}`, {
      headers: token ? { cookie: `maiaflow_token=${token}` } : {},
    }),
  );
}

describe("proxy (optimistic auth check)", () => {
  it("sends visitors without a session to login, remembering where they wanted to go", () => {
    const response = call("/tasks?status=done");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Ftasks%3Fstatus%3Ddone",
    );
  });

  it("does not add ?next= for the home page", () => {
    expect(call("/").headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("treats an expired token as no session", () => {
    expect(call("/tasks", jwt(-10)).headers.get("location")).toContain("/login");
  });

  it("lets visitors reach the login and sign-up pages", () => {
    expect(call("/login").headers.get("location")).toBeNull();
    expect(call("/signup").headers.get("location")).toBeNull();
  });

  it("sends signed-in users away from the login and sign-up pages", () => {
    expect(call("/login", jwt(3600)).headers.get("location")).toBe("http://localhost:3000/");
    expect(call("/signup", jwt(3600)).headers.get("location")).toBe("http://localhost:3000/");
  });

  it("lets signed-in users through", () => {
    expect(call("/tasks", jwt(3600)).headers.get("location")).toBeNull();
  });

  it("adds a Content-Security-Policy whose nonce is new for every request", () => {
    const first = call("/tasks", jwt(3600)).headers.get("content-security-policy");
    const second = call("/tasks", jwt(3600)).headers.get("content-security-policy");

    expect(first).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(first).not.toBe(second);
  });

  it("forwards the nonce to the page through request headers", () => {
    const response = call("/login");
    const overridden = response.headers.get("x-middleware-override-headers") ?? "";

    expect(overridden).toContain("x-nonce");
    expect(overridden).toContain("content-security-policy");
  });
});
