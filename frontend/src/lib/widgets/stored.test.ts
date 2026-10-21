import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DASHBOARD } from "./default-dashboard";
import { toDashboard } from "./stored";

afterEach(() => vi.restoreAllMocks());

describe("toDashboard", () => {
  it("uses the default set when nothing is stored", () => {
    expect(toDashboard({ revision: 2, config: null })).toEqual({
      revision: 2,
      config: DEFAULT_DASHBOARD,
      isDefault: true,
    });
    expect(toDashboard({ revision: 0 }).isDefault).toBe(true);
  });

  it("uses a stored configuration that passes the rules", () => {
    const config = { version: 1, sections: [{ id: "s", title: "Minha", widgets: [] }] };
    expect(toDashboard({ revision: 5, config })).toEqual({ revision: 5, config, isDefault: false });
  });

  it("falls back to the default, keeping the revision, when the stored one cannot be used", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(toDashboard({ revision: 3, config: { version: 9 } })).toMatchObject({
      revision: 3,
      isDefault: true,
    });
    expect(
      toDashboard({
        revision: 3,
        config: { version: 1, sections: [{ id: "BAD", title: "x", widgets: [] }] },
      }).isDefault,
    ).toBe(true);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
