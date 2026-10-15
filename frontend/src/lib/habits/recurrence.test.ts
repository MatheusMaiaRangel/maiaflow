import { describe, expect, it } from "vitest";
import {
  anchorHint,
  buildRecurrencePayload,
  DEFAULT_RECURRENCE,
  joinList,
  recurrenceFromHabit,
  summarizeRecurrence,
  toggleMonthDay,
  type HabitRule,
  type RecurrenceValues,
} from "./recurrence";

function rule(overrides: Partial<HabitRule> = {}): HabitRule {
  return {
    currentFrequencyType: "Daily",
    currentIntervalDays: null,
    currentDaysOfWeek: 0,
    currentDaysOfMonth: [],
    currentLastDayOfMonth: false,
    ...overrides,
  };
}

function values(overrides: Partial<RecurrenceValues>): RecurrenceValues {
  return { ...DEFAULT_RECURRENCE, ...overrides };
}

// 2026-10-14 is a Wednesday.
const WEDNESDAY = "2026-10-14";
const SATURDAY = "2026-10-17";
const SUNDAY = "2026-10-18";

describe("summarizeRecurrence", () => {
  it("describes a daily habit", () => {
    expect(summarizeRecurrence(rule(), WEDNESDAY)).toBe("Todos os dias");
  });

  it("repeats weekly on the weekday of the rule start, with the right gender", () => {
    const weekly = rule({ currentFrequencyType: "Weekly" });
    expect(summarizeRecurrence(weekly, WEDNESDAY)).toBe("Toda quarta-feira");
    expect(summarizeRecurrence(weekly, SATURDAY)).toBe("Todo sábado");
    expect(summarizeRecurrence(weekly, SUNDAY)).toBe("Todo domingo");
  });

  it("lists the days of a monthly habit", () => {
    const monthly = (days: number[], last = false) =>
      rule({
        currentFrequencyType: "Monthly",
        currentDaysOfMonth: days,
        currentLastDayOfMonth: last,
      });
    expect(summarizeRecurrence(monthly([5]), WEDNESDAY)).toBe("Todo mês, no dia 5");
    expect(summarizeRecurrence(monthly([15, 1, 31]), WEDNESDAY)).toBe(
      "Todo mês, nos dias 1, 15 e 31",
    );
    expect(summarizeRecurrence(monthly([], true), WEDNESDAY)).toBe(
      "Todo mês, no último dia do mês",
    );
    expect(summarizeRecurrence(monthly([1, 15], true), WEDNESDAY)).toBe(
      "Todo mês, nos dias 1 e 15 e no último dia do mês",
    );
    expect(summarizeRecurrence(monthly([]), WEDNESDAY)).toBe("Todo mês");
  });

  it("repeats yearly on the day and month of the rule start", () => {
    expect(summarizeRecurrence(rule({ currentFrequencyType: "Yearly" }), WEDNESDAY)).toBe(
      "Todo ano, em 14 de outubro",
    );
  });

  it("describes an interval in days", () => {
    const interval = (days: number | null) =>
      rule({ currentFrequencyType: "IntervalDays", currentIntervalDays: days });
    expect(summarizeRecurrence(interval(3), WEDNESDAY)).toBe("A cada 3 dias");
    expect(summarizeRecurrence(interval(1), WEDNESDAY)).toBe("Todos os dias");
    expect(summarizeRecurrence(interval(null), WEDNESDAY)).toBe("A cada alguns dias");
  });

  it("lists specific weekdays from the mask", () => {
    const days = (mask: number) =>
      rule({ currentFrequencyType: "SpecificDaysOfWeek", currentDaysOfWeek: mask });
    expect(summarizeRecurrence(days(42), WEDNESDAY)).toBe("Dias da semana: seg, qua e sex");
    expect(summarizeRecurrence(days(65), WEDNESDAY)).toBe("Dias da semana: dom e sáb");
    expect(summarizeRecurrence(days(4), WEDNESDAY)).toBe("Dias da semana: ter");
    expect(summarizeRecurrence(days(127), WEDNESDAY)).toBe("Todos os dias");
    expect(summarizeRecurrence(days(0), WEDNESDAY)).toBe("Dias da semana");
  });
});

describe("anchorHint", () => {
  it("explains the weekday a weekly habit repeats on", () => {
    expect(anchorHint("Weekly", WEDNESDAY)).toBe(
      "Repete toda quarta-feira (o dia da semana de 14 de outubro de 2026).",
    );
  });

  it("explains the day a yearly habit repeats on", () => {
    expect(anchorHint("Yearly", WEDNESDAY)).toBe(
      "Repete todo ano em 14 de outubro (o dia de 14 de outubro de 2026).",
    );
  });

  it("warns that 29 February only happens in leap years", () => {
    expect(anchorHint("Yearly", "2028-02-29")).toContain("Só acontece em anos bissextos.");
  });

  it("uses a generic text when the start of the rule is not known yet", () => {
    expect(anchorHint("Weekly", null)).toContain("mesmo dia da semana");
    expect(anchorHint("Yearly", null)).toContain("mesmo dia e mês");
  });

  it("has no hint for the other types", () => {
    expect(anchorHint("Daily", WEDNESDAY)).toBeNull();
    expect(anchorHint("Monthly", WEDNESDAY)).toBeNull();
  });
});

describe("buildRecurrencePayload", () => {
  it("sends neutral values for a daily habit, whatever else is in the form", () => {
    const payload = buildRecurrencePayload(
      values({ frequencyType: "Daily", intervalDays: "4", daysOfWeek: 42, daysOfMonth: [3] }),
    );
    expect(payload).toEqual({
      frequencyType: "Daily",
      daysOfWeek: 0,
      daysOfMonth: [],
      lastDayOfMonth: false,
    });
    expect("intervalDays" in payload).toBe(false);
  });

  it("sends the interval as a number only for IntervalDays", () => {
    expect(
      buildRecurrencePayload(values({ frequencyType: "IntervalDays", intervalDays: " 10 " })),
    ).toEqual({
      frequencyType: "IntervalDays",
      intervalDays: 10,
      daysOfWeek: 0,
      daysOfMonth: [],
      lastDayOfMonth: false,
    });
  });

  it("sends the weekday mask only for SpecificDaysOfWeek", () => {
    expect(
      buildRecurrencePayload(values({ frequencyType: "SpecificDaysOfWeek", daysOfWeek: 42 })),
    ).toMatchObject({ daysOfWeek: 42 });
    expect(
      buildRecurrencePayload(values({ frequencyType: "Weekly", daysOfWeek: 42 })),
    ).toMatchObject({ daysOfWeek: 0 });
  });

  it("sends sorted, unique days of the month and the last-day flag only for Monthly", () => {
    expect(
      buildRecurrencePayload(
        values({ frequencyType: "Monthly", daysOfMonth: [15, 1, 15], lastDayOfMonth: true }),
      ),
    ).toMatchObject({ daysOfMonth: [1, 15], lastDayOfMonth: true });
    expect(
      buildRecurrencePayload(
        values({ frequencyType: "Yearly", daysOfMonth: [1], lastDayOfMonth: true }),
      ),
    ).toMatchObject({ daysOfMonth: [], lastDayOfMonth: false });
  });
});

describe("recurrenceFromHabit", () => {
  it("copies the current rule into form values without sharing the array", () => {
    const habit = rule({
      currentFrequencyType: "Monthly",
      currentIntervalDays: null,
      currentDaysOfMonth: [1, 2],
      currentLastDayOfMonth: true,
    });
    const result = recurrenceFromHabit(habit);
    expect(result).toEqual({
      frequencyType: "Monthly",
      intervalDays: "",
      daysOfWeek: 0,
      daysOfMonth: [1, 2],
      lastDayOfMonth: true,
    });
    expect(result.daysOfMonth).not.toBe(habit.currentDaysOfMonth);
  });

  it("turns the interval into text", () => {
    expect(
      recurrenceFromHabit(rule({ currentFrequencyType: "IntervalDays", currentIntervalDays: 7 }))
        .intervalDays,
    ).toBe("7");
  });
});

describe("toggleMonthDay", () => {
  it("adds a day keeping the list sorted and removes it on the second toggle", () => {
    const added = toggleMonthDay([1, 20], 5);
    expect(added).toEqual([1, 5, 20]);
    expect(toggleMonthDay(added, 5)).toEqual([1, 20]);
  });

  it("does not change the original list", () => {
    const original = [3];
    toggleMonthDay(original, 4);
    expect(original).toEqual([3]);
  });
});

describe("joinList", () => {
  it("joins in Portuguese", () => {
    expect(joinList([])).toBe("");
    expect(joinList(["a"])).toBe("a");
    expect(joinList(["a", "b"])).toBe("a e b");
    expect(joinList(["a", "b", "c"])).toBe("a, b e c");
  });
});
