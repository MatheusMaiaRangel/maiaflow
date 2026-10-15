import { describe, expect, test } from "vitest";
import { addMonths } from "@/lib/dates";
import {
  buildWeeks,
  canGoToNextMonth,
  canGoToPreviousMonth,
  defaultSelection,
  gridRange,
  isInMonth,
  isInRange,
  MAX_MONTHS_AHEAD,
  isDayAllowed,
  MAX_MONTHS_BACK,
  moveSelection,
  shiftMonths,
} from "./grid";

describe("gridRange", () => {
  test("starts on the Sunday before the 1st and ends on the Saturday after the last day", () => {
    // 1 Oct 2026 is a Thursday, 31 Oct 2026 a Saturday.
    expect(gridRange("2026-10-14")).toEqual({ start: "2026-09-27", end: "2026-10-31" });
  });

  test("covers six weeks when the month needs them and never more than 42 days", () => {
    // 1 Aug 2026 is a Saturday, 31 Aug a Monday.
    const { start, end } = gridRange("2026-08-01");
    expect({ start, end }).toEqual({ start: "2026-07-26", end: "2026-09-05" });
    expect(buildWeeks("2026-08-01").flat()).toHaveLength(42);
  });

  test("a month that begins on Sunday and ends on Saturday has no extra days", () => {
    // Feb 2026: 1 Feb is a Sunday, 28 Feb a Saturday.
    expect(gridRange("2026-02-10")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
});

describe("buildWeeks", () => {
  test("returns whole weeks of seven consecutive days starting on Sunday", () => {
    const weeks = buildWeeks("2026-10-01");

    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });
});

describe("month helpers", () => {
  test("isInMonth compares calendar months", () => {
    expect(isInMonth("2026-09-30", "2026-10-14")).toBe(false);
    expect(isInMonth("2026-10-31", "2026-10-01")).toBe(true);
  });

  test("isInRange includes both ends", () => {
    const range = { start: "2026-09-27", end: "2026-10-31" };
    expect(isInRange("2026-09-27", range)).toBe(true);
    expect(isInRange("2026-10-31", range)).toBe(true);
    expect(isInRange("2026-11-01", range)).toBe(false);
  });

  test("defaultSelection is today in its month and the 1st elsewhere", () => {
    expect(defaultSelection("2026-10-01", "2026-10-14")).toBe("2026-10-14");
    expect(defaultSelection("2026-11-01", "2026-10-14")).toBe("2026-11-01");
  });

  test("shiftMonths keeps the day or clamps it to the end of a shorter month", () => {
    expect(shiftMonths("2026-10-14", 1)).toBe("2026-11-14");
    expect(shiftMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
});

describe("navigation limits", () => {
  const today = "2026-10-14";

  test("allows going back and forward inside the API range", () => {
    expect(canGoToPreviousMonth("2026-10-01", today)).toBe(true);
    expect(canGoToNextMonth("2026-10-01", today)).toBe(true);
  });

  test("stops at the oldest and newest month the API accepts", () => {
    expect(canGoToPreviousMonth("2016-12-01", today)).toBe(false);
    expect(canGoToPreviousMonth("2017-01-01", today)).toBe(true);
    expect(canGoToNextMonth("2031-08-01", today)).toBe(false);
    expect(canGoToNextMonth("2031-07-01", today)).toBe(true);
    expect(MAX_MONTHS_BACK).toBeLessThan(120);
    expect(MAX_MONTHS_AHEAD).toBeLessThan(60);
  });
});

describe("moveSelection", () => {
  test.each([
    ["ArrowLeft", "2026-10-13"],
    ["ArrowRight", "2026-10-15"],
    ["ArrowUp", "2026-10-07"],
    ["ArrowDown", "2026-10-21"],
    ["Home", "2026-10-11"],
    ["End", "2026-10-17"],
    ["PageUp", "2026-09-14"],
    ["PageDown", "2026-11-14"],
  ])("%s moves from 14 Oct 2026 to %s", (key, expected) => {
    expect(moveSelection("2026-10-14", key)).toBe(expected);
  });

  test("ignores other keys", () => {
    expect(moveSelection("2026-10-14", "a")).toBeUndefined();
  });
});

describe("isDayAllowed", () => {
  const today = "2026-10-14";

  test("accepts days of the months the calendar can show", () => {
    expect(isDayAllowed("2026-10-31", today)).toBe(true);
    expect(isDayAllowed("2031-08-20", today)).toBe(true);
  });

  test("rejects days whose grid would go past what the API accepts", () => {
    expect(isDayAllowed("2031-09-01", today)).toBe(false);
    expect(isDayAllowed("2016-11-30", today)).toBe(false);
  });

  test("the last month shown stays inside the API's 5-year window", () => {
    const lastMonth = addMonths(today, MAX_MONTHS_AHEAD);
    expect(gridRange(lastMonth).end <= "2031-10-14").toBe(true);
  });
});
