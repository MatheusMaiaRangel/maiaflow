// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env", () => {
  it("defaults API_URL to the local API", async () => {
    vi.stubEnv("API_URL", "");

    expect((await import("./env")).env.API_URL).toBe("http://localhost:5011");
  });

  it("reads API_URL from the environment", async () => {
    vi.stubEnv("API_URL", "https://api.example.com");

    expect((await import("./env")).env.API_URL).toBe("https://api.example.com");
  });

  it("fails fast on an invalid API_URL", async () => {
    vi.stubEnv("API_URL", "not a url");

    await expect(import("./env")).rejects.toThrow();
  });
});
