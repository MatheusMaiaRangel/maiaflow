import { z } from "zod";
import { addDays, formatDateShort, isDateOnly, type DateOnly } from "@/lib/dates";
import { effectiveFromBounds, startDateBounds, type DateBounds } from "@/lib/habits/date-limits";
import {
  FREQUENCY_TYPES,
  MAX_INTERVAL_DAYS,
  MAX_MONTH_DAY,
  MIN_INTERVAL_DAYS,
  MIN_MONTH_DAY,
} from "@/lib/habits/recurrence";
import { ALL_WEEKDAYS_MASK } from "@/lib/habits/weekdays";

export const MIN_TITLE_LENGTH = 3;
export const MAX_TITLE_LENGTH = 150;
export const MAX_DESCRIPTION_LENGTH = 500;

const INTEGER_PATTERN = /^\d+$/;

const title = z
  .string()
  .trim()
  .min(MIN_TITLE_LENGTH, `O título deve ter pelo menos ${MIN_TITLE_LENGTH} caracteres.`)
  .max(MAX_TITLE_LENGTH, `O título deve ter no máximo ${MAX_TITLE_LENGTH} caracteres.`);

const description = z
  .string()
  .trim()
  .max(
    MAX_DESCRIPTION_LENGTH,
    `A descrição deve ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`,
  );

function isValidInterval(text: string): boolean {
  const trimmed = text.trim();
  if (!INTEGER_PATTERN.test(trimmed)) return false;
  const interval = Number(trimmed);
  return interval >= MIN_INTERVAL_DAYS && interval <= MAX_INTERVAL_DAYS;
}

const recurrenceShape = z.object({
  frequencyType: z.enum(FREQUENCY_TYPES),
  intervalDays: z.string(),
  daysOfWeek: z.number().int().min(0).max(ALL_WEEKDAYS_MASK),
  daysOfMonth: z.array(z.number().int().min(MIN_MONTH_DAY).max(MAX_MONTH_DAY)),
  lastDayOfMonth: z.boolean(),
});

/** Every type needs its own fields: an interval, some weekdays, or some days of the month. */
export const recurrenceSchema = recurrenceShape.superRefine((value, ctx) => {
  if (value.frequencyType === "IntervalDays" && !isValidInterval(value.intervalDays)) {
    ctx.addIssue({
      code: "custom",
      path: ["intervalDays"],
      message: `Informe um número inteiro de ${MIN_INTERVAL_DAYS} a ${MAX_INTERVAL_DAYS} dias.`,
    });
  }
  if (value.frequencyType === "SpecificDaysOfWeek" && value.daysOfWeek === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["daysOfWeek"],
      message: "Escolha pelo menos um dia da semana.",
    });
  }
  if (
    value.frequencyType === "Monthly" &&
    value.daysOfMonth.length === 0 &&
    !value.lastDayOfMonth
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["daysOfMonth"],
      message: "Escolha pelo menos um dia do mês ou marque “Último dia do mês”.",
    });
  }
});

const INVALID_DATE_MESSAGE = "Informe uma data válida.";

/** A `yyyy-MM-dd` string inside the bounds. An empty string is an error only when `requiredMessage` is set. */
function dateWithin(bounds: DateBounds, rangeMessage: string, requiredMessage?: string) {
  return z.string().superRefine((day, ctx) => {
    if (day === "" && requiredMessage === undefined) return;
    if (day === "") return ctx.addIssue({ code: "custom", message: requiredMessage });
    if (!isDateOnly(day)) return ctx.addIssue({ code: "custom", message: INVALID_DATE_MESSAGE });
    if (day < bounds.min || day > bounds.max) {
      ctx.addIssue({ code: "custom", message: rangeMessage });
    }
  });
}

/** Create form. The API only accepts start dates from 2 years back to 5 years ahead of today. */
export function createHabitSchema(today: DateOnly) {
  return z.object({
    title,
    description,
    startDate: dateWithin(
      startDateBounds(today),
      "A data de início deve estar entre 2 anos atrás e 5 anos à frente.",
      "Informe a data de início.",
    ),
    recurrence: recurrenceSchema,
  });
}

/** "Editar": title and description only. */
export const editHabitSchema = z.object({ title, description });

/** "Alterar recorrência": the new rule plus an optional start date (empty = first free day). */
export function changeRecurrenceSchema(today: DateOnly, currentRuleStart?: DateOnly) {
  const bounds = effectiveFromBounds(today, currentRuleStart);
  const rangeMessage =
    bounds.min === addDays(today, 1)
      ? "A data deve ser de amanhã até 5 anos à frente."
      : `A data deve ser a partir de ${formatDateShort(bounds.min)}, quando começa a recorrência atual.`;
  return z.object({
    recurrence: recurrenceSchema,
    effectiveFrom: dateWithin(bounds, rangeMessage),
  });
}

export type CreateHabitFormValues = z.infer<ReturnType<typeof createHabitSchema>>;
export type EditHabitFormValues = z.infer<typeof editHabitSchema>;
export type ChangeRecurrenceFormValues = z.infer<ReturnType<typeof changeRecurrenceSchema>>;
