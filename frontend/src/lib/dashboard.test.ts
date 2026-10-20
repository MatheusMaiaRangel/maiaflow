import { describe, expect, test } from "vitest";
import type { Occurrence } from "@/lib/habits/occurrences";
import type { HabitStatsDay, HabitStatsItem } from "@/lib/habits/stats";
import type { Task } from "@/lib/tasks/hooks";
import {
  dayProgress,
  formatPercent,
  percentOf,
  streakUnit,
  sumDays,
  topStreak,
  windowCompletion,
} from "./dashboard";

function occurrence(id: number, status: Occurrence["status"]): Occurrence {
  return { id, habitId: id, habitTitle: `Hábito ${id}`, date: "2026-10-14T00:00:00", status };
}

function task(id: number, status: Task["status"] = "Pending"): Task {
  return {
    id,
    title: `Tarefa ${id}`,
    description: null,
    dueDate: null,
    status,
    createdOn: null,
    completedOn: null,
  };
}

function day(date: string, completed: number, notCompleted: number, pending: number) {
  return { date: `${date}T00:00:00`, completed, notCompleted, pending } satisfies HabitStatsDay;
}

function item(habitId: number, completionRate: number | null, currentStreak = 0): HabitStatsItem {
  return {
    habitId,
    habitTitle: `Hábito ${habitId}`,
    scheduled: 10,
    completed: 5,
    notCompleted: 5,
    pending: 0,
    completionRate,
    currentStreak,
    bestStreak: currentStreak,
  };
}

describe("percentOf and formatPercent", () => {
  test("rounds to a whole percentage", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(2, 3)).toBe(67);
    expect(formatPercent(67)).toBe("67%");
  });

  test("has no value when there is nothing to count", () => {
    expect(percentOf(0, 0)).toBeNull();
    expect(formatPercent(null)).toBe("—");
  });
});

describe("dayProgress", () => {
  test("adds habits and tasks done out of everything for today", () => {
    const progress = dayProgress([occurrence(1, "Completed"), occurrence(2, "Pending")], {
      overdue: [task(3)],
      dueToday: [task(4, "Completed"), task(5)],
    });

    expect(progress).toEqual({ done: 2, total: 5, percent: 40 });
  });

  test("has no percentage on a day with nothing planned", () => {
    expect(dayProgress([], { overdue: [], dueToday: [] })).toEqual({
      done: 0,
      total: 0,
      percent: null,
    });
  });
});

describe("topStreak", () => {
  test("picks the highest current streak, the first one on a tie", () => {
    expect(topStreak([item(1, 0.5, 3), item(2, 0.5, 12), item(3, 0.5, 12)])).toEqual({
      title: "Hábito 2",
      streak: 12,
    });
  });

  test("is undefined without habits", () => {
    expect(topStreak([])).toBeUndefined();
  });
});

describe("streak words", () => {
  test("counts occurrences in a row, singular and plural", () => {
    expect(streakUnit(1)).toBe("seguida");
    expect(streakUnit(0)).toBe("seguidas");
    expect(streakUnit(12)).toBe("seguidas");
  });
});

describe("windowCompletion", () => {
  test("leaves out today's pending occurrences (the last day)", () => {
    const days = [
      day("2026-10-12", 2, 1, 1),
      day("2026-10-13", 1, 0, 0),
      day("2026-10-14", 1, 0, 3),
    ];

    // 4 completed of 2+1+1 + 1 + 1 (today's 3 pending left out) = 6.
    expect(windowCompletion(days)).toEqual({ done: 4, total: 6, percent: 67 });
  });

  test("has no percentage when only today's pending occurrences exist", () => {
    expect(windowCompletion([day("2026-10-13", 0, 0, 0), day("2026-10-14", 0, 0, 2)])).toEqual({
      done: 0,
      total: 0,
      percent: null,
    });
    expect(windowCompletion([]).percent).toBeNull();
  });

  test("sums each status over the window", () => {
    expect(sumDays([day("2026-10-13", 1, 2, 3), day("2026-10-14", 4, 5, 6)])).toEqual({
      completed: 5,
      notCompleted: 7,
      pending: 9,
    });
  });
});
