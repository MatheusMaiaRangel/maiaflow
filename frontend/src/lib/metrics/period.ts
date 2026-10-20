import { addDays, isDateOnly, parseDateOnly, type DateOnly } from "@/lib/dates";
import { MAX_PERIOD_DAYS, PERIOD_PRESETS, type DateRange, type Period } from "./types";

const MS_PER_DAY = 86_400_000;

/** Days from `from` to `to`, both included (0 when `to` is before `from`). */
export function daysBetween(from: DateOnly, to: DateOnly): number {
  const toUtc = (day: DateOnly) => {
    const { year, month, day: dayOfMonth } = parseDateOnly(day);
    return Date.UTC(year, month - 1, dayOfMonth);
  };
  return Math.max(0, Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY) + 1);
}

/** The days a period covers, relative to `today`. Assumes a valid period (see {@link periodError}). */
export function resolvePeriod(period: Period, today: DateOnly): DateRange {
  switch (period.kind) {
    case "last":
      return { from: addDays(today, -(period.days - 1)), to: today };
    case "next":
      return { from: today, to: addDays(today, period.days - 1) };
    case "custom":
      return { from: period.from, to: period.to };
  }
}

/** Why a period cannot be used (Brazilian Portuguese, shown in the builder), or `null` when it is fine. */
export function periodError(period: Period): string | null {
  if (period.kind !== "custom") {
    return (PERIOD_PRESETS as readonly number[]).includes(period.days)
      ? null
      : "Escolha 7, 30 ou 90 dias.";
  }
  if (!isDateOnly(period.from) || !isDateOnly(period.to)) return "Informe datas válidas.";
  if (period.to < period.from) return "A data final deve ser depois da inicial.";
  if (daysBetween(period.from, period.to) > MAX_PERIOD_DAYS) {
    return `O período pode ter no máximo ${MAX_PERIOD_DAYS} dias.`;
  }
  return null;
}

/** Every day of the range, oldest first. */
export function eachDay({ from, to }: DateRange): DateOnly[] {
  return Array.from({ length: daysBetween(from, to) }, (_, offset) => addDays(from, offset));
}

export function isWithin(day: DateOnly, { from, to }: DateRange): boolean {
  return day >= from && day <= to;
}

/** The smallest range covering all of them, or `null` for none. */
export function unionRange(ranges: readonly DateRange[]): DateRange | null {
  if (ranges.length === 0) return null;
  return ranges.reduce((union, range) => ({
    from: range.from < union.from ? range.from : union.from,
    to: range.to > union.to ? range.to : union.to,
  }));
}

/** Splits a range into consecutive pieces of at most `size` days (the calendar endpoint's limit). */
export function splitRange(range: DateRange, size = MAX_PERIOD_DAYS): DateRange[] {
  const pieces: DateRange[] = [];
  for (let from = range.from; from <= range.to; from = addDays(from, size)) {
    const end = addDays(from, size - 1);
    pieces.push({ from, to: end < range.to ? end : range.to });
  }
  return pieces;
}
