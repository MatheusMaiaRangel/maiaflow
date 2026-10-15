import {
  addDays,
  addMonths,
  daysInMonth,
  endOfMonth,
  parseDateOnly,
  formatDateOnly,
  startOfMonth,
  weekdayOf,
  type DateOnly,
} from "@/lib/dates";

/** The week starts on Sunday (0) and ends on Saturday (6). */
const LAST_WEEKDAY = 6;
const DAYS_PER_WEEK = 7;

/**
 * The API accepts calendar ranges from 10 years back to 5 years ahead. The grid also shows the rest of the
 * first and last weeks (up to about 5 weeks past the month), so stay a month and a half inside both limits.
 */
export const MAX_MONTHS_BACK = 118;
export const MAX_MONTHS_AHEAD = 58;

export type DateRange = { start: DateOnly; end: DateOnly };

/** First and last day shown for a month: whole weeks, so it includes days of the neighbouring months. */
export function gridRange(month: DateOnly): DateRange {
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  return {
    start: addDays(first, -weekdayOf(first)),
    end: addDays(last, LAST_WEEKDAY - weekdayOf(last)),
  };
}

/** The days of the month grid, one array per week (Sunday first). */
export function buildWeeks(month: DateOnly): DateOnly[][] {
  const { start, end } = gridRange(month);
  const weeks: DateOnly[][] = [];
  for (let weekStart = start; weekStart <= end; weekStart = addDays(weekStart, DAYS_PER_WEEK)) {
    weeks.push(Array.from({ length: DAYS_PER_WEEK }, (_, offset) => addDays(weekStart, offset)));
  }
  return weeks;
}

export function isInMonth(day: DateOnly, month: DateOnly): boolean {
  return startOfMonth(day) === startOfMonth(month);
}

export function isInRange(day: DateOnly, range: DateRange): boolean {
  return day >= range.start && day <= range.end;
}

/** Today when the month contains it, otherwise the first day of the month. */
export function defaultSelection(month: DateOnly, today: DateOnly): DateOnly {
  return isInMonth(today, month) ? today : startOfMonth(month);
}

export function canGoToPreviousMonth(month: DateOnly, today: DateOnly): boolean {
  return startOfMonth(month) > addMonths(today, -MAX_MONTHS_BACK);
}

export function canGoToNextMonth(month: DateOnly, today: DateOnly): boolean {
  return startOfMonth(month) < addMonths(today, MAX_MONTHS_AHEAD);
}

/** Whether the month of `day` can be shown (its grid range stays inside what the API accepts). */
export function isDayAllowed(day: DateOnly, today: DateOnly): boolean {
  const month = startOfMonth(day);
  return month >= addMonths(today, -MAX_MONTHS_BACK) && month <= addMonths(today, MAX_MONTHS_AHEAD);
}

/** Moves a day by whole months, keeping the day of the month when possible (31 Jan + 1 = 28 Feb). */
export function shiftMonths(day: DateOnly, amount: number): DateOnly {
  const target = addMonths(day, amount);
  const { year, month } = parseDateOnly(target);
  return formatDateOnly(year, month, Math.min(parseDateOnly(day).day, daysInMonth(year, month)));
}

/** The day a navigation key moves to, or `undefined` for keys the grid does not handle. */
export function moveSelection(day: DateOnly, key: string): DateOnly | undefined {
  switch (key) {
    case "ArrowLeft":
      return addDays(day, -1);
    case "ArrowRight":
      return addDays(day, 1);
    case "ArrowUp":
      return addDays(day, -DAYS_PER_WEEK);
    case "ArrowDown":
      return addDays(day, DAYS_PER_WEEK);
    case "Home":
      return addDays(day, -weekdayOf(day));
    case "End":
      return addDays(day, LAST_WEEKDAY - weekdayOf(day));
    case "PageUp":
      return shiftMonths(day, -1);
    case "PageDown":
      return shiftMonths(day, 1);
    default:
      return undefined;
  }
}
