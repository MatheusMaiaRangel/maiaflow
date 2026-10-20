import { addDays, formatDateShort, weekdayOf, type DateOnly } from "@/lib/dates";
import { eachDay } from "./period";
import type { Bucket, DateRange, Grouping } from "./types";

export const TOTAL_KEY = "total";

/** Sunday first, like the calendar. */
export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/** "14/10" */
export function dayMonth(day: DateOnly): string {
  return formatDateShort(day).slice(0, 5);
}

/** The Sunday that starts the week of `day`. */
export function weekStart(day: DateOnly): DateOnly {
  return addDays(day, -weekdayOf(day));
}

export function habitKey(habitId: number): string {
  return `habit:${habitId}`;
}

/** The key of the bucket a day falls in, for the time groupings (`none`, `day`, `week`, `weekday`). */
export function timeKey(grouping: Exclude<Grouping, "habit">, day: DateOnly): string {
  switch (grouping) {
    case "none":
      return TOTAL_KEY;
    case "day":
      return day;
    case "week":
      return weekStart(day);
    case "weekday":
      return String(weekdayOf(day));
  }
}

/**
 * Buckets of a time grouping over the range, in order. Weeks start on Sunday and are clipped to the range,
 * so the first and last may be shorter; each is labelled with its first day inside the range.
 */
export function timeBuckets(grouping: Exclude<Grouping, "habit">, range: DateRange): Bucket[] {
  switch (grouping) {
    case "none":
      return [{ key: TOTAL_KEY, label: "Total", range }];
    case "day":
      return eachDay(range).map((day) => ({
        key: day,
        label: dayMonth(day),
        range: { from: day, to: day },
      }));
    case "week": {
      const buckets: Bucket[] = [];
      for (let start = weekStart(range.from); start <= range.to; start = addDays(start, 7)) {
        const from = start < range.from ? range.from : start;
        const end = addDays(start, 6);
        buckets.push({
          key: start,
          label: dayMonth(from),
          range: { from, to: end < range.to ? end : range.to },
        });
      }
      return buckets;
    }
    case "weekday":
      return WEEKDAY_SHORT.map((label, index) => ({ key: String(index), label }));
  }
}

/** One bucket per habit, ordered by id (the order habits were created), labelled with the latest title. */
export function habitBuckets(habits: ReadonlyMap<number, string>): Bucket[] {
  return [...habits.entries()]
    .toSorted(([a], [b]) => a - b)
    .map(([habitId, title]) => ({ key: habitKey(habitId), label: title }));
}
