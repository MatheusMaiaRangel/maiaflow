/**
 * Types of the metrics engine (decision D26). A query names what to count (one or more metrics), over which
 * days (period), for which habits (filter) and split how (grouping); the engine answers with one value per
 * bucket and metric. Every chart of the Today dashboard is described by one of these queries.
 */
import type { DateOnly } from "@/lib/dates";
import type { Occurrence } from "@/lib/habits/occurrences";
import type { Task } from "@/lib/tasks/hooks";

export const TASK_VARIABLES = [
  "tasks.created",
  "tasks.completed",
  "tasks.completedOnTime",
  "tasks.completedLate",
  "tasks.completedWithDueDate",
  "tasks.completedWithoutDueDate",
  "tasks.openPending",
  "tasks.openOverdue",
  "tasks.openWithoutDueDate",
] as const;

export const HABIT_VARIABLES = [
  "habits.scheduled",
  "habits.completed",
  "habits.notCompleted",
  "habits.pending",
  "habits.completionRate",
  "habits.currentStreak",
] as const;

export type TaskVariable = (typeof TASK_VARIABLES)[number];
export type HabitVariable = (typeof HABIT_VARIABLES)[number];
export type Variable = TaskVariable | HabitVariable;

export const VARIABLES: readonly Variable[] = [...TASK_VARIABLES, ...HABIT_VARIABLES];

export const GROUPINGS = ["none", "day", "week", "weekday", "habit"] as const;
export type Grouping = (typeof GROUPINGS)[number];

export const PERIOD_PRESETS = [7, 30, 90] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

/** Longest custom period, the same limit as `/api/habits/calendar`. */
export const MAX_PERIOD_DAYS = 366;

/**
 * `last`: the last N days ending today. `next`: today and the next N − 1 days. `custom`: fixed days,
 * both inclusive, at most {@link MAX_PERIOD_DAYS}.
 */
export type Period =
  | { kind: "last"; days: PeriodPreset }
  | { kind: "next"; days: PeriodPreset }
  | { kind: "custom"; from: DateOnly; to: DateOnly };

/** Which habits the habit variables look at. Task variables ignore it. */
export type HabitFilter = { kind: "all" } | { kind: "habit"; habitId: number };

/** A variable, or "A ÷ B in %" when `divideBy` is set (both must be counts). */
export type Metric = { variable: Variable; divideBy?: Variable };

export type MetricQuery = {
  metrics: readonly Metric[];
  grouping: Grouping;
  period: Period;
  habitFilter: HabitFilter;
};

/** What the engine reads: the user's tasks and the habit occurrences of the days it needs. */
export type MetricData = {
  tasks: readonly Task[];
  occurrences: readonly Occurrence[];
  /** Today in Brasília (D15). */
  today: DateOnly;
};

/** `count`: a number of things; `percent`: 0–100; `streak`: occurrences in a row. */
export type Unit = "count" | "percent" | "streak";

export type DateRange = { from: DateOnly; to: DateOnly };

export type Bucket = {
  key: string;
  /** Short label for axes and tables ("14/10", "Seg", the habit title). */
  label: string;
  /** Days covered by the bucket (time groupings only). */
  range?: DateRange;
};

export type SeriesResult = {
  unit: Unit;
  /** One value per bucket; `null` when there is nothing to measure (a rate of zero things). */
  values: (number | null)[];
  /** For ratios, the counts behind each value ("18 de 22"). */
  parts?: { numerator: number[]; denominator: number[] };
};

export type MetricResult = {
  range: DateRange;
  buckets: Bucket[];
  /** One entry per metric of the query, in the same order. */
  series: SeriesResult[];
};
