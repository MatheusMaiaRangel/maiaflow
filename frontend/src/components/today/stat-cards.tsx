"use client";

import { AlarmClockIcon, FlameIcon, PercentIcon, TargetIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DASHBOARD_DAYS,
  dayProgress,
  formatPercent,
  NO_VALUE,
  streakUnit,
  topStreak,
  windowCompletion,
} from "@/lib/dashboard";
import type { DateOnly } from "@/lib/dates";
import type { Occurrence } from "@/lib/habits/occurrences";
import type { HabitStats } from "@/lib/habits/stats";
import type { Task } from "@/lib/tasks/hooks";
import { selectTodayTasks } from "@/lib/today";
import { cn } from "@/lib/utils";
import { hasFailed, type QueryState } from "./query-state";
import { SectionError } from "./section-states";

const NO_HABITS = "Nenhum hábito ainda";

type StatCardsProps = {
  today: DateOnly;
  occurrences: QueryState<Occurrence[]>;
  tasks: QueryState<Task[]>;
  stats: QueryState<HabitStats>;
};

/** The four numbers on top of the dashboards: 2×2 on phones, one row when there is room. */
export function StatCards({ today, occurrences, tasks, stats }: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
      <DayProgressCard today={today} occurrences={occurrences} tasks={tasks} />
      <OverdueCard today={today} tasks={tasks} />
      <TopStreakCard stats={stats} />
      <WindowCompletionCard stats={stats} />
    </div>
  );
}

function StatCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className="grid min-w-0 content-start gap-2 rounded-xl border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 id={titleId} className="text-sm font-medium text-muted-foreground">
          {title}
        </h3>
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      {children}
    </div>
  );
}

function StatValue({
  value,
  unit,
  detail,
  valueClassName,
}: {
  value: string | number;
  unit?: string;
  detail: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <p className={cn("text-2xl font-semibold tracking-tight tabular-nums", valueClassName)}>
        {value}
        {unit ? <span className="text-sm font-medium"> {unit}</span> : null}
      </p>
      <div className="text-xs break-words text-muted-foreground">{detail}</div>
    </div>
  );
}

function CardSkeleton({ label }: { label: string }) {
  return <Skeleton role="status" aria-label={label} className="h-12 w-full" />;
}

function DayProgressCard({
  today,
  occurrences,
  tasks,
}: Pick<StatCardsProps, "today" | "occurrences" | "tasks">) {
  const title = "Progresso do dia";
  const body = (() => {
    if (hasFailed(occurrences) || hasFailed(tasks)) {
      const retry = () => {
        if (hasFailed(occurrences)) occurrences.refetch();
        if (hasFailed(tasks)) tasks.refetch();
      };
      return <SectionError compact what="o progresso" onRetry={retry} />;
    }
    if (!occurrences.data || !tasks.data) return <CardSkeleton label="Carregando progresso" />;

    const progress = dayProgress(occurrences.data, selectTodayTasks(tasks.data, today));
    return (
      <StatValue
        value={formatPercent(progress.percent)}
        detail={
          progress.total === 0
            ? "Nada previsto para hoje"
            : `${progress.done} de ${progress.total} concluídos`
        }
      />
    );
  })();
  return (
    <StatCard title={title} icon={TargetIcon}>
      {body}
    </StatCard>
  );
}

function OverdueCard({ today, tasks }: Pick<StatCardsProps, "today" | "tasks">) {
  const body = (() => {
    if (hasFailed(tasks)) {
      return <SectionError compact what="as tarefas" onRetry={() => tasks.refetch()} />;
    }
    if (!tasks.data) return <CardSkeleton label="Carregando tarefas atrasadas" />;

    const count = selectTodayTasks(tasks.data, today).overdue.length;
    return (
      <StatValue
        value={count}
        valueClassName={count > 0 ? "text-destructive" : undefined}
        detail={
          <Link
            href="/tasks"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver tarefas
          </Link>
        }
      />
    );
  })();
  return (
    <StatCard title="Atrasadas" icon={AlarmClockIcon}>
      {body}
    </StatCard>
  );
}

/** Shared states of the cards that read the completion history. */
function statsBody(
  stats: QueryState<HabitStats>,
  loadingLabel: string,
  render: (data: HabitStats) => ReactNode,
): ReactNode {
  if (hasFailed(stats)) {
    return <SectionError compact what="o histórico" onRetry={() => stats.refetch()} />;
  }
  if (!stats.data) return <CardSkeleton label={loadingLabel} />;
  if (stats.data.habits.length === 0) return <StatValue value={NO_VALUE} detail={NO_HABITS} />;
  return render(stats.data);
}

function TopStreakCard({ stats }: Pick<StatCardsProps, "stats">) {
  return (
    <StatCard title="Maior sequência" icon={FlameIcon}>
      {statsBody(stats, "Carregando sequências", (data) => {
        const top = topStreak(data.habits);
        if (!top || top.streak === 0) {
          return <StatValue value={0} unit={streakUnit(0)} detail="Nenhuma sequência ainda" />;
        }
        return <StatValue value={top.streak} unit={streakUnit(top.streak)} detail={top.title} />;
      })}
    </StatCard>
  );
}

function WindowCompletionCard({ stats }: Pick<StatCardsProps, "stats">) {
  return (
    <StatCard title={`Conclusão em ${DASHBOARD_DAYS} dias`} icon={PercentIcon}>
      {statsBody(stats, "Carregando conclusão", (data) => {
        const completion = windowCompletion(data.days);
        return (
          <StatValue
            value={formatPercent(completion.percent)}
            detail={
              completion.total === 0
                ? "Nada para contar ainda"
                : `${completion.done} de ${completion.total} feitos`
            }
          />
        );
      })}
    </StatCard>
  );
}
