"use client";

import { useId } from "react";
import { DashboardView } from "@/components/widgets/dashboard-view";
import { DASHBOARD_DAYS } from "@/lib/dashboard";
import type { DateOnly } from "@/lib/dates";
import { useOccurrences, type Occurrence } from "@/lib/habits/occurrences";
import { useHabitStats, type HabitStats } from "@/lib/habits/stats";
import type { ServerSeed } from "@/lib/query-seed";
import { useTasks, type Task } from "@/lib/tasks/hooks";
import { DEFAULT_DASHBOARD } from "@/lib/widgets/default-dashboard";
import { StatCards } from "./stat-cards";

type DashboardsProps = {
  today: DateOnly;
  /** The lists on the same screen seed these queries too; passing them keeps this part self-contained. */
  tasksSeed?: ServerSeed<Task[]>;
  occurrencesSeed?: ServerSeed<Occurrence[]>;
  /** Missing when the server could not read the history; the client then fetches it. */
  statsSeed?: ServerSeed<HabitStats>;
};

/**
 * "Resumo": the four fixed stat cards, then the dashboard of widgets (D26; phase 6 shows the default set).
 * The cards use the lists already on screen and the completion history of `/api/habits/stats` (D24); the
 * widgets are computed by the metrics engine from the task list and the habit calendar.
 */
export function Dashboards({ today, tasksSeed, occurrencesSeed, statsSeed }: DashboardsProps) {
  const headingId = useId();
  const occurrences = useOccurrences(today, today, occurrencesSeed);
  const tasks = useTasks(tasksSeed);
  const stats = useHabitStats(DASHBOARD_DAYS, today, statsSeed);

  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-4">
      <h2 id={headingId} className="text-lg font-semibold tracking-tight">
        Resumo
      </h2>
      <StatCards today={today} occurrences={occurrences} tasks={tasks} stats={stats} />
      <DashboardView config={DEFAULT_DASHBOARD} today={today} tasksSeed={tasksSeed} />
    </section>
  );
}
