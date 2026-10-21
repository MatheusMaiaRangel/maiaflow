/** Words of the dashboard editor (Brazilian Portuguese) and the choices it offers. */
import { addDays, type DateOnly } from "@/lib/dates";
import { VARIABLE_INFO } from "@/lib/metrics/catalog";
import {
  HABIT_VARIABLES,
  PERIOD_PRESETS,
  TASK_VARIABLES,
  type Metric,
  type Period,
  type Variable,
} from "@/lib/metrics/types";
import { MAX_LABEL_LENGTH, type ChartType, type SeriesConfig } from "./config";

export const CHART_LABELS: Readonly<Record<ChartType, string>> = {
  bar: "Barras",
  line: "Linhas",
  area: "Área",
  donut: "Rosca",
  number: "Número",
  heatmap: "Mapa de calor",
  list: "Lista",
};

export const MARK_LABELS: Readonly<Record<NonNullable<SeriesConfig["mark"]>, string>> = {
  bar: "Barras",
  line: "Linha",
  area: "Área",
};

type Option = { value: string; label: string };

function variableOptions(variables: readonly Variable[]): Option[] {
  return variables.map((variable) => ({ value: variable, label: VARIABLE_INFO[variable].label }));
}

/** Every variable, grouped by where it comes from. */
export const VARIABLE_GROUPS = [
  { label: "Tarefas", options: variableOptions(TASK_VARIABLES) },
  { label: "Hábitos", options: variableOptions(HABIT_VARIABLES) },
] as const;

/** Only counts can be divided ("A ÷ B em %"). */
export const COUNT_VARIABLE_GROUPS = VARIABLE_GROUPS.map((group) => ({
  label: group.label,
  options: group.options.filter(({ value }) => VARIABLE_INFO[value as Variable].unit === "count"),
}));

export function isCountVariable(variable: Variable): boolean {
  return VARIABLE_INFO[variable].unit === "count";
}

/** The name a series gets until the user types one: the variable, or "A ÷ B". */
export function autoLabel({ variable, divideBy }: Metric): string {
  const label =
    divideBy === undefined
      ? VARIABLE_INFO[variable].label
      : `${VARIABLE_INFO[variable].label} ÷ ${VARIABLE_INFO[divideBy].label}`;
  return label.length <= MAX_LABEL_LENGTH ? label : `${label.slice(0, MAX_LABEL_LENGTH - 1)}…`;
}

export const CUSTOM_PERIOD = "custom";

/** Select values of the period presets ("last-30", "next-7"). */
export const PERIOD_OPTIONS: readonly Option[] = [
  ...PERIOD_PRESETS.map((days) => ({ value: `last-${days}`, label: `Últimos ${days} dias` })),
  ...PERIOD_PRESETS.map((days) => ({ value: `next-${days}`, label: `Próximos ${days} dias` })),
  { value: CUSTOM_PERIOD, label: "Personalizado" },
];

export function periodValue(period: Period): string {
  return period.kind === "custom" ? CUSTOM_PERIOD : `${period.kind}-${period.days}`;
}

/** Days a new custom period covers, ending today. */
const CUSTOM_START_DAYS = 30;

/** The period for a select value; a new custom period starts as the last 30 days. */
export function periodFromValue(value: string, current: Period, today: DateOnly): Period {
  if (value === CUSTOM_PERIOD) {
    return current.kind === "custom"
      ? current
      : { kind: "custom", from: addDays(today, -(CUSTOM_START_DAYS - 1)), to: today };
  }
  const [kind, days] = value.split("-");
  const preset = Number(days);
  if (
    (kind === "last" || kind === "next") &&
    (PERIOD_PRESETS as readonly number[]).includes(preset)
  ) {
    return { kind, days: preset as (typeof PERIOD_PRESETS)[number] };
  }
  return current;
}
