import { dateOnly, formatDateLong, type DateOnly } from "@/lib/dates";
import type { Occurrence } from "@/lib/habits/occurrences";

const YEAR_SUFFIX = / de \d{4}$/;

export const FUTURE_DAY_REASON = "Ainda não chegou o dia";

export type DaySummary = {
  total: number;
  completed: number;
  notCompleted: number;
  pending: number;
};

export type OccurrencesByDay = ReadonlyMap<DateOnly, readonly Occurrence[]>;

export function groupByDay(occurrences: readonly Occurrence[]): OccurrencesByDay {
  const groups = new Map<DateOnly, Occurrence[]>();
  for (const occurrence of occurrences) {
    const day = dateOnly(occurrence.date);
    groups.set(day, [...(groups.get(day) ?? []), occurrence]);
  }
  return groups;
}

export function summarize(occurrences: readonly Occurrence[]): DaySummary {
  const count = (status: Occurrence["status"]) =>
    occurrences.filter((occurrence) => occurrence.status === status).length;
  return {
    total: occurrences.length,
    completed: count("Completed"),
    notCompleted: count("NotCompleted"),
    pending: count("Pending"),
  };
}

/** Why the status of an occurrence cannot be changed, or `undefined` when it can. */
export function disabledReasonFor(occurrence: Occurrence, today: DateOnly): string | undefined {
  const isFuture = dateOnly(occurrence.date) > today;
  return isFuture || occurrence.id <= 0 ? FUTURE_DAY_REASON : undefined;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Screen-reader label of a day cell, e.g. "14 de outubro, 2 hábitos, 1 feito". */
export function dayAriaLabel(day: DateOnly, summary: DaySummary): string {
  const date = formatDateLong(day).replace(YEAR_SUFFIX, "");
  if (summary.total === 0) return `${date}, sem hábitos`;
  const parts = [date, plural(summary.total, "hábito", "hábitos")];
  if (summary.completed > 0) parts.push(plural(summary.completed, "feito", "feitos"));
  if (summary.notCompleted > 0) parts.push(plural(summary.notCompleted, "não feito", "não feitos"));
  return parts.join(", ");
}
