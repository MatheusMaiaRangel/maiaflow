"use client";

import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import type { DateOnly } from "@/lib/dates";
import { calendarKey, fetchOccurrences, type Occurrence } from "@/lib/habits/occurrences";
import { computeMetrics, needsTasks, requiredHabitRange } from "@/lib/metrics/engine";
import { splitRange, unionRange } from "@/lib/metrics/period";
import type { DateRange, MetricResult } from "@/lib/metrics/types";
import type { ServerSeed } from "@/lib/query-seed";
import { useTasks, type Task } from "@/lib/tasks/hooks";
import { widgetErrors, widgetQuery, type WidgetConfig } from "./config";

/** The part of a query result a widget needs. */
export type Source<T> = { data: T | undefined; isError: boolean; refetch: () => unknown };

export type DashboardSources = { tasks: Source<Task[]>; occurrences: Source<Occurrence[]> };

export type WidgetState =
  | { status: "loading" }
  | { status: "error"; what: string; retry: () => void }
  /** The configuration itself cannot be drawn (only possible once users edit it, phase 7). */
  | { status: "invalid"; errors: string[] }
  | { status: "ready"; result: MetricResult };

/** Every habit day any of the widgets needs, or `null` when none looks at habits. */
export function habitRangeFor(widgets: readonly WidgetConfig[], today: DateOnly): DateRange | null {
  return unionRange(
    widgets
      .map((widget) => requiredHabitRange(widgetQuery(widget), today))
      .filter((range): range is DateRange => range !== null),
  );
}

type PieceResult = UseQueryResult<Occurrence[]>;

/** Module-level so TanStack Query can keep the joined list stable between renders. */
function joinPieces(results: PieceResult[]): Source<Occurrence[]> {
  return {
    data: results.every((result) => result.data !== undefined)
      ? results.flatMap((result) => result.data ?? [])
      : undefined,
    isError: results.some((result) => result.isError),
    refetch: () => Promise.all(results.map((result) => result.refetch())),
  };
}

/**
 * The tasks and the habit occurrences the widgets need, loaded once for all of them. Occurrences come from
 * `/api/habits/calendar` (at most 366 days per call, so longer spans are split). They live under the
 * calendar keys, so marking a habit updates the charts at once.
 */
export function useDashboardSources(
  widgets: readonly WidgetConfig[],
  today: DateOnly,
  tasksSeed?: ServerSeed<Task[]>,
): DashboardSources {
  const tasks = useTasks(tasksSeed);
  const range = habitRangeFor(widgets, today);
  const occurrences = useQueries({
    queries: (range ? splitRange(range) : []).map(({ from, to }) => ({
      queryKey: calendarKey(from, to),
      queryFn: () => fetchOccurrences(from, to),
    })),
    combine: joinPieces,
  });

  return { tasks, occurrences };
}

function failed<T>(source: Source<T>): boolean {
  return source.isError && source.data === undefined;
}

/** What a widget can show right now: its numbers, or why not yet. */
export function widgetState(
  widget: WidgetConfig,
  { tasks, occurrences }: DashboardSources,
  today: DateOnly,
): WidgetState {
  const errors = widgetErrors(widget);
  if (errors.length > 0) return { status: "invalid", errors };

  const query = widgetQuery(widget);
  const usesTasks = needsTasks(query);
  const usesHabits = requiredHabitRange(query, today) !== null;

  if (usesTasks && failed(tasks)) {
    return { status: "error", what: "as tarefas", retry: () => void tasks.refetch() };
  }
  if (usesHabits && failed(occurrences)) {
    return { status: "error", what: "os hábitos", retry: () => void occurrences.refetch() };
  }
  if ((usesTasks && !tasks.data) || (usesHabits && !occurrences.data)) return { status: "loading" };

  return {
    status: "ready",
    result: computeMetrics(query, {
      tasks: tasks.data ?? [],
      occurrences: occurrences.data ?? [],
      today,
    }),
  };
}
