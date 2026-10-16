import { describe, expect, it } from "vitest";
import { effectiveFromBounds, shiftYears, startDateBounds } from "./date-limits";

describe("shiftYears", () => {
  it("moves a day by whole years", () => {
    expect(shiftYears("2026-10-14", -2)).toBe("2024-10-14");
    expect(shiftYears("2026-10-14", 5)).toBe("2031-10-14");
  });

  it("falls back to 28 February when the target year is not a leap year", () => {
    expect(shiftYears("2028-02-29", -1)).toBe("2027-02-28");
    expect(shiftYears("2028-02-29", 4)).toBe("2032-02-29");
  });
});

describe("date bounds", () => {
  it("allows start dates from 2 years back to 5 years ahead", () => {
    expect(startDateBounds("2026-10-14")).toEqual({ min: "2024-10-14", max: "2031-10-14" });
  });

  it("allows a recurrence change from tomorrow to 5 years ahead", () => {
    expect(effectiveFromBounds("2026-10-14")).toEqual({ min: "2026-10-15", max: "2031-10-14" });
  });

  it("never starts before the current rule, which may begin in the future", () => {
    expect(effectiveFromBounds("2026-10-14", "2026-10-20").min).toBe("2026-10-20");
    expect(effectiveFromBounds("2026-10-14", "2026-01-01").min).toBe("2026-10-15");
  });
});
