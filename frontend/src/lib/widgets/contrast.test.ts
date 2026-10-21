import { describe, expect, it } from "vitest";
import { contrastRatio, describeContrastIssues, seriesContrastIssues } from "./contrast";

describe("contrastRatio", () => {
  it("matches the WCAG formula", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });
});

describe("series colors", () => {
  it("warns about a pale color on the light card", () => {
    const issues = seriesContrastIssues("#f5f5a0");
    expect(issues.map(({ theme }) => theme)).toEqual(["light"]);
    expect(describeContrastIssues(issues)).toMatch(/^Pouco contraste no modo claro \(1,\d:1\)\.$/);
  });

  it("warns about a dark color on the dark card", () => {
    expect(seriesContrastIssues("#202020").map(({ theme }) => theme)).toEqual(["dark"]);
  });

  it("accepts a mid color in both themes", () => {
    expect(seriesContrastIssues("#e0457b")).toEqual([]);
    expect(describeContrastIssues([])).toBe("");
  });

  it("joins issues in both themes", () => {
    const text = describeContrastIssues([
      { theme: "light", ratio: 1.25 },
      { theme: "dark", ratio: 2 },
    ]);
    expect(text).toBe("Pouco contraste no modo claro (1,3:1) e no modo escuro (2,0:1).");
  });
});
