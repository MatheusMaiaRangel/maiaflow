/**
 * Days of the week as the API's bit mask: Sunday = 1, Monday = 2, Tuesday = 4, ... Saturday = 64.
 * Indexes (0 = Sunday ... 6 = Saturday) match `weekdayOf` in `@/lib/dates`.
 */

export type Weekday = {
  index: number;
  bit: number;
  /** Two-three letter label for buttons. */
  short: string;
  /** Full name for screen readers. */
  long: string;
};

export const WEEKDAYS: readonly Weekday[] = [
  { index: 0, bit: 1, short: "Dom", long: "Domingo" },
  { index: 1, bit: 2, short: "Seg", long: "Segunda-feira" },
  { index: 2, bit: 4, short: "Ter", long: "Terça-feira" },
  { index: 3, bit: 8, short: "Qua", long: "Quarta-feira" },
  { index: 4, bit: 16, short: "Qui", long: "Quinta-feira" },
  { index: 5, bit: 32, short: "Sex", long: "Sexta-feira" },
  { index: 6, bit: 64, short: "Sáb", long: "Sábado" },
];

export const ALL_WEEKDAYS_MASK = 127;

function bitOf(index: number): number {
  const weekday = WEEKDAYS[index];
  if (!weekday) throw new RangeError(`Invalid weekday index: ${index}`);
  return weekday.bit;
}

export function hasWeekday(mask: number, index: number): boolean {
  return (mask & bitOf(index)) !== 0;
}

/** The mask with the weekday switched on or off. Returns a new number. */
export function toggleWeekday(mask: number, index: number): number {
  return mask ^ bitOf(index);
}

/** Weekday indexes (ascending) that are on in the mask. */
export function weekdaysFromMask(mask: number): number[] {
  return WEEKDAYS.filter(({ bit }) => (mask & bit) !== 0).map(({ index }) => index);
}

/** The mask for a list of weekday indexes (duplicates are fine). */
export function maskFromWeekdays(indexes: readonly number[]): number {
  return indexes.reduce((mask, index) => mask | bitOf(index), 0);
}
