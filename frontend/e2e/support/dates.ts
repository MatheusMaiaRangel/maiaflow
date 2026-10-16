/**
 * Calendar-day helpers for the tests. "Today" is the day in America/Sao_Paulo, computed with Intl the
 * same way the app does it; the machine's local time zone is never used.
 */

const BRASILIA_TIME_ZONE = "America/Sao_Paulo";

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

/** Today in Brasília as `yyyy-MM-dd` (the en-CA locale formats dates that way). */
export function todayInBrasilia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BRASILIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toUtcMs(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date);
}

/** `day` moved by `offset` calendar days, as `yyyy-MM-dd`. */
export function addDays(day: string, offset: number): string {
  return new Date(toUtcMs(day) + offset * MS_PER_DAY).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayIndex(day: string): number {
  return new Date(toUtcMs(day)).getUTCDay();
}

/** "Toda quinta-feira" / "Todo sábado", like the habit card summary. */
export function everyWeekdaySummary(day: string): string {
  const index = weekdayIndex(day);
  const article = index === 0 || index === 6 ? "Todo" : "Toda";
  return `${article} ${WEEKDAY_NAMES[index]}`;
}

/** "14 de outubro" */
export function dayAndMonth(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  return `${date} de ${MONTH_NAMES[month - 1]}`;
}

/** Day of the month as a number (no leading zero). */
export function dayOfMonth(day: string): number {
  return Number(day.slice(8, 10));
}

/** "quinta-feira, 15 de outubro", like the heading of the calendar's day panel. */
export function dateWithWeekday(day: string): string {
  return `${WEEKDAY_NAMES[weekdayIndex(day)]}, ${dayAndMonth(day)}`;
}

/** "15/10/2026" */
export function shortDate(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

/** True when both days are in the same calendar month. */
export function isSameMonth(first: string, second: string): boolean {
  return first.slice(0, 7) === second.slice(0, 7);
}
