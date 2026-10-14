// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getAuthedApi: async () => ({ GET: get }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

import { getCurrentUser } from "./user";

const result = (status: number, data?: unknown, error?: unknown) => ({
  data,
  error,
  response: { status },
});

beforeEach(() => get.mockReset());

describe("getCurrentUser", () => {
  it("returns only name and e-mail", async () => {
    get.mockResolvedValue(
      result(200, { name: "Maria Silva", email: "maria@example.com", extra: "x" }),
    );

    expect(await getCurrentUser()).toEqual({ name: "Maria Silva", email: "maria@example.com" });
  });

  it("treats a deleted user as a dead session", async () => {
    get.mockResolvedValue(result(404, undefined, { detail: "Usuário não encontrado." }));

    await expect(getCurrentUser()).rejects.toThrow("NEXT_REDIRECT:/auth/session-expired");
  });

  it("lets unexpected errors reach the error page", async () => {
    get.mockResolvedValue(result(500, undefined, { detail: "x" }));

    await expect(getCurrentUser()).rejects.toThrow("API request failed with status 500");
  });
});
