"use client";

import { ChartColumnIcon } from "lucide-react";
import Link from "next/link";
import { useId, type ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DASHBOARD_DAYS } from "@/lib/dashboard";
import type { DateOnly } from "@/lib/dates";
import { useOccurrences, type Occurrence } from "@/lib/habits/occurrences";
import { useHabitStats, type HabitStats } from "@/lib/habits/stats";
import type { ServerSeed } from "@/lib/query-seed";
import { useTasks, type Task } from "@/lib/tasks/hooks";
import { DailyChart } from "./daily-chart";
import { HabitRatesChart } from "./habit-rates-chart";
import { hasFailed, type QueryState } from "./query-state";
import { SectionError } from "./section-states";
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
 * "Resumo": four stat cards and two charts. Today's progress comes from the lists already on screen (same
 * queries, no extra request); the rest from the completion history of the last days.
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
      <Charts stats={stats} />
    </section>
  );
}

function Charts({ stats }: { stats: QueryState<HabitStats> }) {
  if (stats.data?.habits.length === 0) {
    return (
      <EmptyState
        icon={ChartColumnIcon}
        title="Nada para mostrar ainda"
        description="Crie um hábito para acompanhar aqui seu histórico e suas sequências."
        action={
          <Link href="/habits" className={buttonVariants({ variant: "outline" })}>
            Criar hábito
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <ChartPanel
        title={`Últimos ${DASHBOARD_DAYS} dias`}
        loadingLabel={`Carregando o histórico dos últimos ${DASHBOARD_DAYS} dias`}
        stats={stats}
      >
        {(data) => <DailyChart days={data.days} />}
      </ChartPanel>
      <ChartPanel title="Por hábito" loadingLabel="Carregando a conclusão por hábito" stats={stats}>
        {(data) => <HabitRatesChart habits={data.habits} />}
      </ChartPanel>
    </div>
  );
}

function ChartPanel({
  title,
  loadingLabel,
  stats,
  children,
}: {
  title: string;
  loadingLabel: string;
  stats: QueryState<HabitStats>;
  children: (data: HabitStats) => ReactNode;
}) {
  const headingId = useId();
  const body = (() => {
    if (hasFailed(stats)) {
      return <SectionError what="o histórico" onRetry={() => stats.refetch()} />;
    }
    if (!stats.data) {
      return <Skeleton role="status" aria-label={loadingLabel} className="h-48 w-full" />;
    }
    return children(stats.data);
  })();

  return (
    <section
      aria-labelledby={headingId}
      className="grid min-w-0 content-start gap-4 rounded-xl border bg-card p-4"
    >
      <h3 id={headingId} className="font-medium">
        {title}
      </h3>
      {body}
    </section>
  );
}
