import type { components } from "@/lib/api/schema";
import { formatDateLong, weekdayName, weekdayOf, type DateOnly } from "@/lib/dates";
import { WEEKDAYS, weekdaysFromMask } from "./weekdays";

export type FrequencyType = components["schemas"]["HabitFrequencyType"];

export const FREQUENCY_TYPES = [
  "Daily",
  "Weekly",
  "Monthly",
  "Yearly",
  "IntervalDays",
  "SpecificDaysOfWeek",
] as const satisfies readonly FrequencyType[];

/** Options of the frequency select. */
export const FREQUENCY_LABELS: Record<FrequencyType, string> = {
  Daily: "Todos os dias",
  Weekly: "Toda semana",
  Monthly: "Todo mês",
  Yearly: "Todo ano",
  IntervalDays: "A cada N dias",
  SpecificDaysOfWeek: "Dias da semana específicos",
};

export const MIN_INTERVAL_DAYS = 1;
export const MAX_INTERVAL_DAYS = 3650;
export const MIN_MONTH_DAY = 1;
export const MAX_MONTH_DAY = 31;

/** What the recurrence form edits. `intervalDays` stays text so the input can be empty. */
export type RecurrenceValues = {
  frequencyType: FrequencyType;
  intervalDays: string;
  daysOfWeek: number;
  daysOfMonth: number[];
  lastDayOfMonth: boolean;
};

export const DEFAULT_RECURRENCE: RecurrenceValues = {
  frequencyType: "Daily",
  intervalDays: "",
  daysOfWeek: 0,
  daysOfMonth: [],
  lastDayOfMonth: false,
};

/** The recurrence fields of `ReadHabitDTO` (the latest rule). */
export type HabitRule = Pick<
  components["schemas"]["ReadHabitDTO"],
  | "currentFrequencyType"
  | "currentIntervalDays"
  | "currentDaysOfWeek"
  | "currentDaysOfMonth"
  | "currentLastDayOfMonth"
>;

/** Form values prefilled from a habit's current rule. */
export function recurrenceFromHabit(habit: HabitRule): RecurrenceValues {
  return {
    frequencyType: habit.currentFrequencyType,
    intervalDays: habit.currentIntervalDays === null ? "" : String(habit.currentIntervalDays),
    daysOfWeek: habit.currentDaysOfWeek,
    daysOfMonth: [...habit.currentDaysOfMonth],
    lastDayOfMonth: habit.currentLastDayOfMonth,
  };
}

function sortedUnique(days: readonly number[]): number[] {
  return [...new Set(days)].sort((a, b) => a - b);
}

/** Toggles a day of the month, keeping the list sorted. Returns a new array. */
export function toggleMonthDay(days: readonly number[], day: number): number[] {
  return days.includes(day)
    ? days.filter((current) => current !== day)
    : sortedUnique([...days, day]);
}

export type RecurrencePayload = {
  frequencyType: FrequencyType;
  intervalDays?: number;
  daysOfWeek: number;
  daysOfMonth: number[];
  lastDayOfMonth: boolean;
};

/** Only the fields that matter for the chosen type; everything else is neutral. */
export function buildRecurrencePayload(values: RecurrenceValues): RecurrencePayload {
  const { frequencyType } = values;
  return {
    frequencyType,
    ...(frequencyType === "IntervalDays" ? { intervalDays: Number(values.intervalDays) } : {}),
    daysOfWeek: frequencyType === "SpecificDaysOfWeek" ? values.daysOfWeek : 0,
    daysOfMonth: frequencyType === "Monthly" ? sortedUnique(values.daysOfMonth) : [],
    lastDayOfMonth: frequencyType === "Monthly" && values.lastDayOfMonth,
  };
}

/** "1", "1 e 2", "1, 2 e 3" */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** Saturday and Sunday are masculine in Portuguese ("todo sábado"), the rest feminine. */
function everyWeekday(index: number): string {
  const isMasculine = index === 0 || index === 6;
  return `${isMasculine ? "Todo" : "Toda"} ${weekdayName(index)}`;
}

/** "14 de outubro" */
function dayAndMonth(day: DateOnly): string {
  return formatDateLong(day).replace(/ de \d{4}$/, "");
}

function monthlySummary(days: readonly number[], lastDay: boolean): string {
  const parts: string[] = [];
  if (days.length === 1) parts.push(`no dia ${days[0]}`);
  if (days.length > 1) parts.push(`nos dias ${joinList(sortedUnique(days).map(String))}`);
  if (lastDay) parts.push("no último dia do mês");
  return parts.length === 0 ? "Todo mês" : `Todo mês, ${parts.join(" e ")}`;
}

function intervalSummary(interval: number | null): string {
  if (interval === null) return "A cada alguns dias";
  if (interval === 1) return "Todos os dias";
  return `A cada ${interval} dias`;
}

function specificDaysSummary(mask: number): string {
  const indexes = weekdaysFromMask(mask);
  if (indexes.length === WEEKDAYS.length) return "Todos os dias";
  if (indexes.length === 0) return "Dias da semana";
  return `Dias da semana: ${joinList(indexes.map((index) => WEEKDAYS[index].short.toLowerCase()))}`;
}

/**
 * One line in Portuguese describing a rule. `anchor` is the day the rule starts (the habit's start
 * date or the date of the latest recurrence change): weekly and yearly rules repeat from it.
 */
export function summarizeRecurrence(habit: HabitRule, anchor: DateOnly): string {
  switch (habit.currentFrequencyType) {
    case "Daily":
      return "Todos os dias";
    case "Weekly":
      return everyWeekday(weekdayOf(anchor));
    case "Monthly":
      return monthlySummary(habit.currentDaysOfMonth, habit.currentLastDayOfMonth);
    case "Yearly":
      return `Todo ano, em ${dayAndMonth(anchor)}`;
    case "IntervalDays":
      return intervalSummary(habit.currentIntervalDays);
    case "SpecificDaysOfWeek":
      return specificDaysSummary(habit.currentDaysOfWeek);
  }
}

/**
 * Explains what weekly and yearly rules repeat on. `anchor` is the start of the rule, or `null`
 * when it is not known yet (a recurrence change without a chosen date).
 */
export function anchorHint(frequencyType: FrequencyType, anchor: DateOnly | null): string | null {
  if (frequencyType !== "Weekly" && frequencyType !== "Yearly") return null;
  if (anchor === null) {
    return frequencyType === "Weekly"
      ? "Repete no mesmo dia da semana em que a mudança começar a valer."
      : "Repete no mesmo dia e mês em que a mudança começar a valer.";
  }
  if (frequencyType === "Weekly") {
    return `Repete ${everyWeekday(weekdayOf(anchor)).toLowerCase()} (o dia da semana de ${formatDateLong(anchor)}).`;
  }
  const leapNote =
    dayAndMonth(anchor) === "29 de fevereiro" ? " Só acontece em anos bissextos." : "";
  return `Repete todo ano em ${dayAndMonth(anchor)} (o dia de ${formatDateLong(anchor)}).${leapNote}`;
}
