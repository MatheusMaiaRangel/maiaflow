import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it.each(["/tasks", "/habits?x=1", "/calendar/2026-10"])("keeps the same-site path %s", (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "tasks",
    "",
    null,
    undefined,
  ])("falls back to / for %j", (target) => {
    expect(safeRedirectPath(target)).toBe("/");
  });

  it("uses the given fallback", () => {
    expect(safeRedirectPath("//x", "/tasks")).toBe("/tasks");
  });
});
