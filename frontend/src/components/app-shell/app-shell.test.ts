import { describe, expect, it } from "vitest";
import { isActive } from "./nav-items";
import { initials } from "./user-menu";

describe("isActive", () => {
  it("matches the home page only exactly", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/tasks", "/")).toBe(false);
  });

  it("matches a section and its sub-pages, but not look-alikes", () => {
    expect(isActive("/tasks", "/tasks")).toBe(true);
    expect(isActive("/tasks/5", "/tasks")).toBe(true);
    expect(isActive("/tasks-archive", "/tasks")).toBe(false);
  });
});

describe("initials", () => {
  it.each([
    ["Maria Silva", "MS"],
    ["maria", "M"],
    ["  João   Pedro  da Costa ", "JC"],
    ["", "?"],
  ])("%j becomes %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
