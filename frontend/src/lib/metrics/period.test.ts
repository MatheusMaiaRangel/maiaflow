import { describe, expect, it } from "vitest";
import {
  daysBetween,
  eachDay,
  isWithin,
  periodError,
  resolvePeriod,
  splitRange,
  unionRange,
} from "./period";
import { TODAY } from "./test-data";

describe("resolvePeriod", () => {
  it("ends the last N days today", () => {
    expect(resolvePeriod({ kind: "last", days: 7 }, TODAY)).toEqual({
      from: "2026-10-11",
      to: "2026-10-17",
    });
    expect(resolvePeriod({ kind: "last", days: 90 }, TODAY).from).toBe("2026-07-20");
  });

  it("starts the next N days today", () => {
    expect(resolvePeriod({ kind: "next", days: 7 }, TODAY)).toEqual({
      from: "2026-10-17",
      to: "2026-10-23",
    });
  });

  it("keeps a custom range as it is", () => {
    expect(resolvePeriod({ kind: "custom", from: "2026-01-01", to: "2026-01-31" }, TODAY)).toEqual({
      from: "2026-01-01",
      to: "2026-01-31",
    });
  });
});

describe("periodError", () => {
  it("accepts the presets and rejects other sizes", () => {
    expect(periodError({ kind: "last", days: 30 })).toBeNull();
    expect(periodError({ kind: "next", days: 90 })).toBeNull();
    expect(periodError({ kind: "last", days: 14 as 7 })).toBe("Escolha 7, 30 ou 90 dias.");
  });

  it("accepts a custom range of up to 366 days", () => {
    expect(periodError({ kind: "custom", from: "2026-01-01", to: "2026-01-01" })).toBeNull();
    expect(periodError({ kind: "custom", from: "2024-01-01", to: "2024-12-31" })).toBeNull(); // leap year
    expect(periodError({ kind: "custom", from: "2025-01-01", to: "2026-01-02" })).toBe(
      "O período pode ter no máximo 366 dias.",
    );
  });

  it("rejects invalid or reversed custom ranges", () => {
    expect(periodError({ kind: "custom", from: "2026-02-30", to: "2026-03-01" })).toBe(
      "Informe datas válidas.",
    );
    expect(periodError({ kind: "custom", from: "2026-03-02", to: "2026-03-01" })).toBe(
      "A data final deve ser depois da inicial.",
    );
  });
});

describe("day helpers", () => {
  it("counts days inclusively and never below zero", () => {
    expect(daysBetween("2026-10-17", "2026-10-17")).toBe(1);
    expect(daysBetween("2026-02-01", "2026-03-01")).toBe(29);
    expect(daysBetween("2026-10-18", "2026-10-17")).toBe(0);
  });

  it("lists every day of a range", () => {
    expect(eachDay({ from: "2026-12-30", to: "2027-01-02" })).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("checks whether a day is inside a range", () => {
    const range = { from: "2026-10-01", to: "2026-10-31" };
    expect(isWithin("2026-10-01", range)).toBe(true);
    expect(isWithin("2026-10-31", range)).toBe(true);
    expect(isWithin("2026-11-01", range)).toBe(false);
  });

  it("joins ranges", () => {
    expect(unionRange([])).toBeNull();
    expect(
      unionRange([
        { from: "2026-10-01", to: "2026-10-10" },
        { from: "2026-09-01", to: "2026-09-05" },
        { from: "2026-10-05", to: "2026-10-20" },
      ]),
    ).toEqual({ from: "2026-09-01", to: "2026-10-20" });
  });

  it("splits long ranges into pieces the calendar endpoint accepts", () => {
    expect(splitRange({ from: "2026-10-01", to: "2026-10-10" }, 4)).toEqual([
      { from: "2026-10-01", to: "2026-10-04" },
      { from: "2026-10-05", to: "2026-10-08" },
      { from: "2026-10-09", to: "2026-10-10" },
    ]);
    expect(splitRange({ from: "2025-01-01", to: "2025-12-31" })).toHaveLength(1);
  });
});
