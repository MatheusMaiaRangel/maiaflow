// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const destroySession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ destroySession: () => destroySession() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

import { logoutAction } from "./actions";

describe("logoutAction", () => {
  it("removes the session cookie and goes to the login page", async () => {
    await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(destroySession).toHaveBeenCalledOnce();
  });
});
