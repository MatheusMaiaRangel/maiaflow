/**
 * The metrics engine (D26): pure functions that turn a {@link MetricQuery} and the user's data into one value
 * per bucket and metric. Nothing here fetches; see `required*` for what a query needs loaded.
 */
import type { DateOnly } from "@/lib/dates";
import type { Occurrence } from "@/lib/habits/occurrences";
import { habitBuckets, habitKey, TOTAL_KEY, timeBuckets, timeKey } from "./buckets";
import { isHabitVariable, isTaskVariable, VARIABLE_INFO } from "./catalog";
import {
  byHabit,
  countsOccurrence,
  currentStreak,
  entersRate,
  habitTitles,
  matchesFilter,
  occurrenceDay,
  streakRange,
} from "./habits";
import { isWithin, periodError, resolvePeriod, unionRange } from "./period";
import { taskDay } from "./tasks";
import {
  GROUPINGS,
  VARIABLES,
  type Bucket,
  type DateRange,
  type Grouping,
  type HabitVariable,
  type Metric,
  type MetricData,
  type MetricQuery,
  type MetricResult,
  type SeriesResult,
  type TaskVariable,
  type Variable,
} from "./types";

type Counts = Map<string, number>;

function variablesOf(query: MetricQuery): Variable[] {
  return query.metrics.flatMap(({ variable, divideBy }) =>
    divideBy === undefined ? [variable] : [variable, divideBy],
  );
}

/** Why the query cannot be computed (Brazilian Portuguese, for the builder); empty when it is valid. */
export function queryErrors(query: MetricQuery): string[] {
  const errors: string[] = [];
  const variables = variablesOf(query);

  if (query.metrics.length === 0) errors.push("Escolha pelo menos uma métrica.");
  if (variables.some((variable) => !VARIABLES.includes(variable))) {
    errors.push("Métrica desconhecida.");
    return errors;
  }
  if (!GROUPINGS.includes(query.grouping)) errors.push("Agrupamento desconhecido.");

  const period = periodError(query.period);
  if (period) errors.push(period);

  if (
    query.habitFilter.kind === "habit" &&
    !(Number.isInteger(query.habitFilter.habitId) && query.habitFilter.habitId > 0)
  ) {
    errors.push("Hábito inválido.");
  }
  if (query.grouping === "habit" && variables.some(isTaskVariable)) {
    errors.push("Agrupar por hábito só funciona com métricas de hábitos.");
  }
  if (
    variables.includes("habits.currentStreak") &&
    query.grouping !== "none" &&
    query.grouping !== "habit"
  ) {
    errors.push("A sequência atual só pode ser vista no total ou por hábito.");
  }
  if (
    query.metrics.some(
      ({ variable, divideBy }) =>
        divideBy !== undefined &&
        (VARIABLE_INFO[variable].unit !== "count" || VARIABLE_INFO[divideBy].unit !== "count"),
    )
  ) {
    errors.push("A divisão só aceita contagens.");
  }
  return errors;
}

/** The habit occurrences a query needs, or `null` when it only looks at tasks. */
export function requiredHabitRange(query: MetricQuery, today: DateOnly): DateRange | null {
  const variables = variablesOf(query).filter(isHabitVariable);
  if (variables.length === 0) return null;
  const ranges = [resolvePeriod(query.period, today)];
  if (variables.includes("habits.currentStreak")) ranges.push(streakRange(today));
  return unionRange(ranges);
}

export function needsTasks(query: MetricQuery): boolean {
  return variablesOf(query).some(isTaskVariable);
}

function increment(counts: Counts, key: string): Counts {
  return counts.set(key, (counts.get(key) ?? 0) + 1);
}

function countTasks(
  variable: TaskVariable,
  query: MetricQuery,
  data: MetricData,
  range: DateRange,
): Counts {
  const grouping = query.grouping as Exclude<Grouping, "habit">;
  const ignoresPeriod = VARIABLE_INFO[variable].kind === "snapshot" && grouping === "none";
  const counts: Counts = new Map();

  for (const task of data.tasks) {
    const day = taskDay(variable, task, data.today);
    if (day === undefined) continue;
    if (ignoresPeriod) {
      increment(counts, TOTAL_KEY);
    } else if (day !== null && isWithin(day, range)) {
      increment(counts, timeKey(grouping, day));
    }
  }
  return counts;
}

function bucketOf(query: MetricQuery, occurrence: Occurrence): string {
  return query.grouping === "habit"
    ? habitKey(occurrence.habitId)
    : timeKey(query.grouping, occurrenceDay(occurrence));
}

/** The query's occurrences: the filtered habits, inside the period. */
function periodOccurrences(query: MetricQuery, data: MetricData, range: DateRange): Occurrence[] {
  return data.occurrences.filter(
    (occurrence) =>
      matchesFilter(occurrence, query.habitFilter) && isWithin(occurrenceDay(occurrence), range),
  );
}

function countHabits(
  variable: Exclude<HabitVariable, "habits.completionRate" | "habits.currentStreak">,
  query: MetricQuery,
  occurrences: readonly Occurrence[],
): Counts {
  const counts: Counts = new Map();
  for (const occurrence of occurrences) {
    if (countsOccurrence(variable, occurrence)) increment(counts, bucketOf(query, occurrence));
  }
  return counts;
}

function counts(
  variable: Variable,
  query: MetricQuery,
  data: MetricData,
  range: DateRange,
): Counts {
  if (isTaskVariable(variable)) return countTasks(variable, query, data, range);
  if (variable === "habits.completionRate" || variable === "habits.currentStreak") {
    throw new RangeError(`${variable} is not a count.`);
  }
  return countHabits(variable, query, periodOccurrences(query, data, range));
}

function completionRates(
  query: MetricQuery,
  data: MetricData,
  range: DateRange,
  buckets: readonly Bucket[],
): (number | null)[] {
  const done: Counts = new Map();
  const counted: Counts = new Map();
  for (const occurrence of periodOccurrences(query, data, range)) {
    if (!entersRate(occurrence, data.today)) continue;
    const key = bucketOf(query, occurrence);
    increment(counted, key);
    if (occurrence.status === "Completed") increment(done, key);
  }
  return buckets.map(({ key }) => percent(done.get(key) ?? 0, counted.get(key) ?? 0));
}

/** Per habit, or the best one for the total. The period is ignored (the run always ends today). */
function streaks(query: MetricQuery, data: MetricData, buckets: readonly Bucket[]): number[] {
  const habits = byHabit(
    data.occurrences.filter((occurrence) => matchesFilter(occurrence, query.habitFilter)),
  );
  const perHabit = new Map(
    [...habits].map(([habitId, list]) => [habitKey(habitId), currentStreak(list, data.today)]),
  );
  return buckets.map(({ key }) =>
    key === TOTAL_KEY ? Math.max(0, ...perHabit.values()) : (perHabit.get(key) ?? 0),
  );
}

function percent(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

function series(
  metric: Metric,
  query: MetricQuery,
  data: MetricData,
  range: DateRange,
  buckets: readonly Bucket[],
): SeriesResult {
  const { variable, divideBy } = metric;

  if (divideBy !== undefined) {
    const top = counts(variable, query, data, range);
    const bottom = counts(divideBy, query, data, range);
    const numerator = buckets.map(({ key }) => top.get(key) ?? 0);
    const denominator = buckets.map(({ key }) => bottom.get(key) ?? 0);
    return {
      unit: "percent",
      values: numerator.map((value, index) => percent(value, denominator[index])),
      parts: { numerator, denominator },
    };
  }
  if (variable === "habits.completionRate") {
    return { unit: "percent", values: completionRates(query, data, range, buckets) };
  }
  if (variable === "habits.currentStreak") {
    return { unit: "streak", values: streaks(query, data, buckets) };
  }
  const found = counts(variable, query, data, range);
  return { unit: "count", values: buckets.map(({ key }) => found.get(key) ?? 0) };
}

function bucketsFor(query: MetricQuery, data: MetricData, range: DateRange): Bucket[] {
  if (query.grouping !== "habit") return timeBuckets(query.grouping, range);
  const habitRange = requiredHabitRange(query, data.today) ?? range;
  return habitBuckets(
    habitTitles(
      data.occurrences.filter(
        (occurrence) =>
          matchesFilter(occurrence, query.habitFilter) &&
          isWithin(occurrenceDay(occurrence), habitRange),
      ),
    ),
  );
}

/**
 * Computes every metric of the query. Throws a `RangeError` for an invalid query; check {@link queryErrors}
 * first when the query comes from the user.
 */
export function computeMetrics(query: MetricQuery, data: MetricData): MetricResult {
  const errors = queryErrors(query);
  if (errors.length > 0) throw new RangeError(errors.join(" "));

  const range = resolvePeriod(query.period, data.today);
  const buckets = bucketsFor(query, data, range);
  return {
    range,
    buckets,
    series: query.metrics.map((metric) => series(metric, query, data, range, buckets)),
  };
}
