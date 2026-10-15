import { describe, expect, test } from "vitest";
import type { Occurrence } from "@/lib/habits/occurrences";
import { dayAriaLabel, disabledReasonFor, FUTURE_DAY_REASON, groupByDay, summarize } from "./days";

function occurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    id: 1,
    habitId: 1,
    habitTitle: "Beber água",
    date: "2026-10-14T00:00:00",
    status: "Pending",
    ...overrides,
  };
}

describe("groupByDay", () => {
  test("groups occurrences by calendar day and keeps their order", () => {
    const first = occurrence({ id: 1, habitId: 1 });
    const second = occurrence({ id: 2, habitId: 2 });
    const other = occurrence({ id: 3, habitId: 1, date: "2026-10-15T00:00:00" });

    const groups = groupByDay([first, second, other]);

    expect(groups.get("2026-10-14")).toEqual([first, second]);
    expect(groups.get("2026-10-15")).toEqual([other]);
    expect(groups.get("2026-10-16")).toBeUndefined();
  });
});

describe("summarize", () => {
  test("counts each status", () => {
    const summary = summarize([
      occurrence({ status: "Completed" }),
      occurrence({ status: "Completed" }),
      occurrence({ status: "NotCompleted" }),
      occurrence({ status: "Pending" }),
    ]);

    expect(summary).toEqual({ total: 4, completed: 2, notCompleted: 1, pending: 1 });
  });

  test("is all zeros for an empty day", () => {
    expect(summarize([])).toEqual({ total: 0, completed: 0, notCompleted: 0, pending: 0 });
  });
});

describe("disabledReasonFor", () => {
  const today = "2026-10-14";

  test("allows today and past stored occurrences", () => {
    expect(disabledReasonFor(occurrence(), today)).toBeUndefined();
    expect(disabledReasonFor(occurrence({ date: "2026-10-01T00:00:00" }), today)).toBeUndefined();
  });

  test("blocks days after today", () => {
    expect(disabledReasonFor(occurrence({ date: "2026-10-15T00:00:00" }), today)).toBe(
      FUTURE_DAY_REASON,
    );
  });

  test("blocks occurrences that are not stored yet (id 0)", () => {
    expect(disabledReasonFor(occurrence({ id: 0 }), today)).toBe(FUTURE_DAY_REASON);
  });
});

describe("dayAriaLabel", () => {
  test("describes the day, the habits and how many are done", () => {
    const summary = { total: 2, completed: 1, notCompleted: 0, pending: 1 };
    expect(dayAriaLabel("2026-10-14", summary)).toBe("14 de outubro, 2 hábitos, 1 feito");
  });

  test("uses the singular, plural and not-done forms", () => {
    expect(
      dayAriaLabel("2026-10-01", { total: 1, completed: 0, notCompleted: 0, pending: 1 }),
    ).toBe("1 de outubro, 1 hábito");
    expect(
      dayAriaLabel("2026-10-02", { total: 3, completed: 2, notCompleted: 1, pending: 0 }),
    ).toBe("2 de outubro, 3 hábitos, 2 feitos, 1 não feito");
    expect(
      dayAriaLabel("2026-10-03", { total: 3, completed: 0, notCompleted: 2, pending: 1 }),
    ).toBe("3 de outubro, 3 hábitos, 2 não feitos");
  });

  test("says when there are no habits", () => {
    expect(dayAriaLabel("2026-10-14", summarize([]))).toBe("14 de outubro, sem hábitos");
  });
});
