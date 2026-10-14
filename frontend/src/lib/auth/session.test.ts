// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = { set: vi.fn(), get: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => store }));

import { createSession, destroySession, getSessionToken } from "./session";

function jwt(expSeconds: number): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode({ exp: expSeconds })}.sig`;
}

beforeEach(() => {
  store.set.mockReset();
  store.get.mockReset();
  store.delete.mockReset();
});

describe("session cookie", () => {
  it("is httpOnly, lax, site-wide and lives as long as the token", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;

    await createSession(jwt(exp));

    const [name, , options] = store.set.mock.calls[0]!;
    expect(name).toBe("maiaflow_token");
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(options.expires).toEqual(new Date(exp * 1000));
  });

  it("is not marked secure outside production (plain http on localhost)", async () => {
    await createSession(jwt(Math.floor(Date.now() / 1000) + 60));

    expect(store.set.mock.calls[0]![2].secure).toBe(false);
  });

  it("returns the token while it is valid", async () => {
    const token = jwt(Math.floor(Date.now() / 1000) + 60);
    store.get.mockReturnValue({ value: token });

    expect(await getSessionToken()).toBe(token);
  });

  it("returns undefined when the cookie is missing, expired or garbage", async () => {
    store.get.mockReturnValue(undefined);
    expect(await getSessionToken()).toBeUndefined();

    store.get.mockReturnValue({ value: jwt(Math.floor(Date.now() / 1000) - 5) });
    expect(await getSessionToken()).toBeUndefined();

    store.get.mockReturnValue({ value: "garbage" });
    expect(await getSessionToken()).toBeUndefined();
  });

  it("is removed on sign-out", async () => {
    await destroySession();

    expect(store.delete).toHaveBeenCalledWith("maiaflow_token");
  });
});
