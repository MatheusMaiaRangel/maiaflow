/** Habit-side helpers of the metrics engine, over the occurrences of `/api/habits/calendar`. */
import { addDays, dateOnly, type DateOnly } from "@/lib/dates";
import type { Occurrence } from "@/lib/habits/occurrences";
import type { DateRange, HabitFilter, HabitVariable } from "./types";

/** How far back the current streak looks, like `/api/habits/stats` (D24): today and the 364 days before. */
export const STREAK_LOOK_BACK_DAYS = 365;

export function streakRange(today: DateOnly): DateRange {
  return { from: addDays(today, -(STREAK_LOOK_BACK_DAYS - 1)), to: today };
}

export function matchesFilter(occurrence: Occurrence, filter: HabitFilter): boolean {
  return filter.kind === "all" || occurrence.habitId === filter.habitId;
}

export function occurrenceDay(occurrence: Occurrence): DateOnly {
  return dateOnly(occurrence.date);
}

/** Whether a counting variable counts this occurrence. */
export function countsOccurrence(
  variable: Exclude<HabitVariable, "habits.completionRate" | "habits.currentStreak">,
  occurrence: Occurrence,
): boolean {
  switch (variable) {
    case "habits.scheduled":
      return true;
    case "habits.completed":
      return occurrence.status === "Completed";
    case "habits.notCompleted":
      return occurrence.status === "NotCompleted";
    case "habits.pending":
      return occurrence.status === "Pending";
  }
}

/**
 * Whether the occurrence enters a completion rate: past days always do; today and later only once marked
 * (the day is not over, so a pending one is not a miss yet). Same rule as D24.
 */
export function entersRate(occurrence: Occurrence, today: DateOnly): boolean {
  return occurrence.status !== "Pending" || occurrenceDay(occurrence) < today;
}

/**
 * Completed occurrences in a row, ending today, of ONE habit. Today's pending occurrence does not break the
 * run; a past pending or a "not done" does. Only the look-back window counts.
 */
export function currentStreak(occurrences: readonly Occurrence[], today: DateOnly): number {
  const { from } = streakRange(today);
  const newestFirst = occurrences
    .filter((occurrence) => {
      const day = occurrenceDay(occurrence);
      return day >= from && day <= today;
    })
    .toSorted((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  let streak = 0;
  for (const occurrence of newestFirst) {
    if (occurrence.status === "Completed") {
      streak += 1;
    } else if (occurrence.status === "Pending" && occurrenceDay(occurrence) === today) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

/** Occurrences grouped by habit id. */
export function byHabit(occurrences: readonly Occurrence[]): Map<number, Occurrence[]> {
  return Map.groupBy(occurrences, (occurrence) => occurrence.habitId);
}

/** Habit id → title, using the title of the newest occurrence (titles can change). */
export function habitTitles(occurrences: readonly Occurrence[]): Map<number, string> {
  const titles = new Map<number, { date: string; title: string }>();
  for (const occurrence of occurrences) {
    const known = titles.get(occurrence.habitId);
    if (!known || occurrence.date >= known.date) {
      titles.set(occurrence.habitId, { date: occurrence.date, title: occurrence.habitTitle });
    }
  }
  return new Map([...titles].map(([id, { title }]) => [id, title]));
}
