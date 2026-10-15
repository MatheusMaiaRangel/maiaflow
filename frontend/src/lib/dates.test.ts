import { describe, expect, test } from "vitest";
import {
  addDays,
  addMonths,
  dateOnly,
  daysInMonth,
  endOfMonth,
  formatDateLong,
  formatDateShort,
  formatDateWithWeekday,
  formatMonthYear,
  isDateOnly,
  startOfMonth,
  todayInBrasilia,
  toApiDateTime,
  weekdayName,
  weekdayOf,
} from "./dates";

describe("todayInBrasilia", () => {
  test("uses the Brasília day when UTC is already the next day", () => {
    // 01:30 UTC on the 15th is 22:30 on the 14th in Brasília (UTC-3).
    expect(todayInBrasilia(new Date("2026-10-15T01:30:00Z"))).toBe("2026-10-14");
  });

  test("uses the same day when UTC and Brasília agree", () => {
    expect(todayInBrasilia(new Date("2026-10-14T15:00:00Z"))).toBe("2026-10-14");
  });

  test("rolls over to the next day at midnight in Brasília", () => {
    expect(todayInBrasilia(new Date("2026-10-14T03:00:00Z"))).toBe("2026-10-14");
    expect(todayInBrasilia(new Date("2026-10-14T02:59:59Z"))).toBe("2026-10-13");
  });
});

describe("API date conversion", () => {
  test("keeps only the calendar day of an API date-time", () => {
    expect(dateOnly("2026-10-14T00:00:00")).toBe("2026-10-14");
    expect(dateOnly("2026-10-14T23:59:59.123Z")).toBe("2026-10-14");
  });

  test("throws for something that is not a date", () => {
    expect(() => dateOnly("not a date")).toThrow(RangeError);
    expect(() => dateOnly("2026-13-40T00:00:00")).toThrow(RangeError);
  });

  test("builds a zone-less midnight date-time", () => {
    expect(toApiDateTime("2026-10-14")).toBe("2026-10-14T00:00:00");
  });

  test("validates calendar days", () => {
    expect(isDateOnly("2026-02-28")).toBe(true);
    expect(isDateOnly("2026-02-29")).toBe(false);
    expect(isDateOnly("2024-02-29")).toBe(true);
    expect(isDateOnly("2026-2-9")).toBe(false);
    expect(isDateOnly(undefined)).toBe(false);
  });
});

describe("date arithmetic", () => {
  test("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 2)).toBe("2024-03-01");
  });

  test("adds months and lands on the first day", () => {
    expect(addMonths("2026-10-14", 1)).toBe("2026-11-01");
    expect(addMonths("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
  });

  test("finds month limits", () => {
    expect(startOfMonth("2026-10-14")).toBe("2026-10-01");
    expect(endOfMonth("2026-10-14")).toBe("2026-10-31");
    expect(endOfMonth("2024-02-10")).toBe("2024-02-29");
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  test("returns the weekday with Sunday as 0", () => {
    expect(weekdayOf("2026-10-14")).toBe(3); // Wednesday
    expect(weekdayOf("2026-10-18")).toBe(0);
    expect(weekdayOf("2026-10-17")).toBe(6);
  });
});

describe("formatting", () => {
  test("formats in Brazilian style", () => {
    expect(formatDateShort("2026-10-04")).toBe("04/10/2026");
    expect(formatDateLong("2026-10-14")).toBe("14 de outubro de 2026");
    expect(formatDateWithWeekday("2026-10-14")).toBe("quarta-feira, 14 de outubro");
    expect(formatMonthYear("2026-03-09")).toBe("março de 2026");
    expect(weekdayName(0)).toBe("domingo");
  });
});
