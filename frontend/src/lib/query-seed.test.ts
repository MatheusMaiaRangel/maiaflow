import { describe, expect, it } from "vitest";
import { toSeed } from "./query-seed";

describe("toSeed", () => {
  it("keeps the data and stamps the fetch time", () => {
    expect(toSeed([1, 2], () => 1234)).toEqual({ data: [1, 2], fetchedAt: 1234 });
  });

  it("uses the current time by default", () => {
    const before = Date.now();
    const seed = toSeed("x");
    expect(seed.fetchedAt).toBeGreaterThanOrEqual(before);
  });
});
