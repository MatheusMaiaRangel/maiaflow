// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const destroySession = vi.fn();
const del = vi.fn();
vi.mock("@/lib/auth/session", () => ({ destroySession: () => destroySession() }));
vi.mock("@/lib/api/client", () => ({ getAuthedApi: async () => ({ DELETE: del }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

import { deleteAccountAction } from "./actions";

beforeEach(() => {
  destroySession.mockReset();
  del.mockReset();
});

describe("deleteAccountAction", () => {
  it("deletes the account, clears the session and goes to the login page", async () => {
    del.mockResolvedValue({ response: new Response(null, { status: 204 }) });

    await expect(deleteAccountAction()).rejects.toThrow("NEXT_REDIRECT:/login?reason=deleted");

    expect(del).toHaveBeenCalledWith("/api/users/me");
    expect(destroySession).toHaveBeenCalledOnce();
  });

  it("treats an account that is already gone as deleted", async () => {
    del.mockResolvedValue({ response: new Response(null, { status: 404 }) });

    await expect(deleteAccountAction()).rejects.toThrow("NEXT_REDIRECT:/login?reason=deleted");
    expect(destroySession).toHaveBeenCalledOnce();
  });

  it("keeps the session and returns the API's message when deletion fails", async () => {
    del.mockResolvedValue({
      error: { detail: "Não foi possível excluir a conta." },
      response: new Response(null, { status: 500 }),
    });

    await expect(deleteAccountAction()).resolves.toEqual({
      error: "Não foi possível excluir a conta.",
    });
    expect(destroySession).not.toHaveBeenCalled();
  });

  it("keeps the session and reports a network failure", async () => {
    del.mockRejectedValue(new TypeError("fetch failed"));

    const result = await deleteAccountAction();

    expect(result.error).toContain("conectar");
    expect(destroySession).not.toHaveBeenCalled();
  });
});
