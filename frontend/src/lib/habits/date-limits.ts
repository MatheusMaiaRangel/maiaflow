import { addDays, daysInMonth, formatDateOnly, parseDateOnly, type DateOnly } from "@/lib/dates";

/** The API accepts a habit start (or a recurrence change) from 2 years back to 5 years ahead. */
export const MAX_YEARS_IN_PAST = 2;
export const MAX_YEARS_AHEAD = 5;

/** Moves a day by whole years; 29 February becomes 28 February in non-leap years. */
export function shiftYears(day: DateOnly, years: number): DateOnly {
  const { year, month, day: dayOfMonth } = parseDateOnly(day);
  const target = year + years;
  return formatDateOnly(target, month, Math.min(dayOfMonth, daysInMonth(target, month)));
}

export type DateBounds = { min: DateOnly; max: DateOnly };

/** Allowed habit start dates, relative to today. */
export function startDateBounds(today: DateOnly): DateBounds {
  return { min: shiftYears(today, -MAX_YEARS_IN_PAST), max: shiftYears(today, MAX_YEARS_AHEAD) };
}

/**
 * Allowed "apply from" dates of a recurrence change. Today's occurrences are generated as soon as the Today
 * or Calendar screen opens, and the API only accepts days after the last generated one: start at tomorrow.
 */
export function effectiveFromBounds(today: DateOnly): DateBounds {
  return { min: addDays(today, 1), max: shiftYears(today, MAX_YEARS_AHEAD) };
}
