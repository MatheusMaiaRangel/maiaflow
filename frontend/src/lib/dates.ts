/**
 * Calendar-date helpers. The API sends dates as `date-time` without a zone ("2026-10-14T00:00:00")
 * and treats them as plain calendar days, so the app works with `yyyy-MM-dd` strings and never builds
 * a `Date` from them in the browser's time zone.
 */

/** Time zone that defines "today" (decision D15). Brazil has no daylight saving. */
export const BRASILIA_TIME_ZONE = "America/Sao_Paulo";

/** A calendar day as `yyyy-MM-dd`. */
export type DateOnly = string;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const WEEKDAY_NAMES = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const MS_PER_DAY = 86_400_000;

export function isDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) return false;
  const { year, month, day } = parseDateOnly(value);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/**
 * Today's date in Brasília. Call it on the server (Server Components) so every screen agrees on the
 * day; the browser clock is never used for this.
 */
export function todayInBrasilia(now: Date = new Date()): DateOnly {
  // The en-CA locale formats dates as yyyy-MM-dd.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BRASILIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The calendar day of an API date-time ("2026-10-14T00:00:00" becomes "2026-10-14"). */
export function dateOnly(apiDateTime: string): DateOnly {
  const day = apiDateTime.slice(0, 10);
  if (!isDateOnly(day)) throw new RangeError(`Invalid API date: ${apiDateTime}`);
  return day;
}

/** The API date-time for a calendar day: midnight, no zone. */
export function toApiDateTime(day: DateOnly): string {
  return `${day}T00:00:00`;
}

export function parseDateOnly(day: DateOnly): { year: number; month: number; day: number } {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  return { year, month, day: dayOfMonth };
}

export function formatDateOnly(year: number, month: number, day: number): DateOnly {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Day of the week: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(day: DateOnly): number {
  const { year, month, day: dayOfMonth } = parseDateOnly(day);
  return new Date(Date.UTC(year, month - 1, dayOfMonth)).getUTCDay();
}

export function addDays(day: DateOnly, amount: number): DateOnly {
  const { year, month, day: dayOfMonth } = parseDateOnly(day);
  const moved = new Date(Date.UTC(year, month - 1, dayOfMonth) + amount * MS_PER_DAY);
  return formatDateOnly(moved.getUTCFullYear(), moved.getUTCMonth() + 1, moved.getUTCDate());
}

/** First day of the month that is `amount` months after the month of `day`. */
export function addMonths(day: DateOnly, amount: number): DateOnly {
  const { year, month } = parseDateOnly(day);
  const index = year * 12 + (month - 1) + amount;
  return formatDateOnly(Math.floor(index / 12), (index % 12) + 1, 1);
}

export function startOfMonth(day: DateOnly): DateOnly {
  const { year, month } = parseDateOnly(day);
  return formatDateOnly(year, month, 1);
}

export function endOfMonth(day: DateOnly): DateOnly {
  const { year, month } = parseDateOnly(day);
  return formatDateOnly(year, month, daysInMonth(year, month));
}

/** "14/10/2026" */
export function formatDateShort(day: DateOnly): string {
  const { year, month, day: dayOfMonth } = parseDateOnly(day);
  return `${String(dayOfMonth).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

/** "14 de outubro de 2026" */
export function formatDateLong(day: DateOnly): string {
  const { year, month, day: dayOfMonth } = parseDateOnly(day);
  return `${dayOfMonth} de ${MONTH_NAMES[month - 1]} de ${year}`;
}

/** "quarta-feira, 14 de outubro" */
export function formatDateWithWeekday(day: DateOnly): string {
  const { month, day: dayOfMonth } = parseDateOnly(day);
  return `${WEEKDAY_NAMES[weekdayOf(day)]}, ${dayOfMonth} de ${MONTH_NAMES[month - 1]}`;
}

/** "outubro de 2026" */
export function formatMonthYear(day: DateOnly): string {
  const { year, month } = parseDateOnly(day);
  return `${MONTH_NAMES[month - 1]} de ${year}`;
}

export function weekdayName(index: number): string {
  return WEEKDAY_NAMES[index];
}
