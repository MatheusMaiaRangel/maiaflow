import { describe, expect, it } from "vitest";
import { getTokenExpiry, isTokenUsable } from "./jwt";

function tokenWith(payload: object): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

describe("getTokenExpiry", () => {
  it("reads exp from the payload", () => {
    expect(getTokenExpiry(tokenWith({ exp: 1_900_000_000 }))).toBe(1_900_000_000);
  });

  it("decodes UTF-8 payloads (names with accents)", () => {
    expect(getTokenExpiry(tokenWith({ name: "João Ângelo", exp: 123 }))).toBe(123);
  });

  it.each(["", "not-a-jwt", "a.b.c", "a..c"])("returns null for %j", (token) => {
    expect(getTokenExpiry(token)).toBeNull();
  });

  it("returns null when exp is missing or not a number", () => {
    expect(getTokenExpiry(tokenWith({ sub: "1" }))).toBeNull();
    expect(getTokenExpiry(tokenWith({ exp: "soon" }))).toBeNull();
  });
});

describe("isTokenUsable", () => {
  const now = Date.UTC(2026, 9, 14);

  it("accepts a token that expires in the future", () => {
    expect(isTokenUsable(tokenWith({ exp: now / 1000 + 60 }), now)).toBe(true);
  });

  it("rejects expired, unreadable and missing tokens", () => {
    expect(isTokenUsable(tokenWith({ exp: now / 1000 - 1 }), now)).toBe(false);
    expect(isTokenUsable("garbage", now)).toBe(false);
    expect(isTokenUsable(undefined, now)).toBe(false);
  });
});
