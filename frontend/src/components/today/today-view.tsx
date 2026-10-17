"use client";

import { CalendarCheckIcon, CircleCheckBigIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { HabitCalendar, OccurrenceStatusControl } from "@/components/calendar";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TaskRow } from "@/components/tasks";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api/browser";
import { disabledReasonFor } from "@/lib/calendar/days";
import { formatDateWithWeekday, type DateOnly } from "@/lib/dates";
import { useOccurrences, useSetOccurrenceStatus } from "@/lib/habits/occurrences";
import type { Occurrence } from "@/lib/habits/occurrences";
import type { HabitStats } from "@/lib/habits/stats";
import type { ServerSeed } from "@/lib/query-seed";
import { useTasks, type Task } from "@/lib/tasks/hooks";
import { habitProgress, selectTodayTasks, taskProgress, type Progress } from "@/lib/today";
import { Dashboards } from "./dashboards";
import { ListSkeleton, SectionError } from "./section-states";

type TodayViewProps = {
  /** Today in Brasília, computed on the server. */
  today: DateOnly;
  tasksSeed: ServerSeed<Task[]>;
  /** Today's occurrences. */
  occurrencesSeed: ServerSeed<Occurrence[]>;
  /** Occurrences of the grid of today's month. */
  calendarSeed: ServerSeed<Occurrence[]>;
  /** Missing when the server could not read it; the dashboards then fetch it themselves. */
  statsSeed?: ServerSeed<HabitStats>;
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function describeProgress({ done, total }: Progress, noun: string): string {
  return `${done} de ${total} ${noun}`;
}

function Section({
  title,
  progress,
  children,
}: {
  title: string;
  progress?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {progress ? <p className="text-sm text-muted-foreground">{progress}</p> : null}
      </div>
      {children}
    </section>
  );
}

function HabitsSection({ today, seed }: { today: DateOnly; seed: ServerSeed<Occurrence[]> }) {
  const occurrences = useOccurrences(today, today, seed);
  const { mutate: setStatus } = useSetOccurrenceStatus();

  const body = (() => {
    if (occurrences.isError && !occurrences.data) {
      return <SectionError what="os hábitos" onRetry={() => occurrences.refetch()} />;
    }
    if (!occurrences.data) return <ListSkeleton label="Carregando hábitos" />;
    if (occurrences.data.length === 0) {
      return (
        <EmptyState
          icon={CalendarCheckIcon}
          title="Nenhum hábito para hoje"
          description="Quando houver hábitos previstos para hoje, eles aparecem aqui."
        />
      );
    }
    return (
      <ul className="grid gap-2">
        {occurrences.data.map((occurrence) => (
          <li
            key={occurrence.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-3 py-3"
          >
            <p className="min-w-0 text-sm font-medium break-words">{occurrence.habitTitle}</p>
            <OccurrenceStatusControl
              occurrence={occurrence}
              disabledReason={disabledReasonFor(occurrence, today)}
              onChange={(status) =>
                setStatus(
                  { id: occurrence.id, status },
                  { onError: (error) => toast.error(errorMessage(error)) },
                )
              }
            />
          </li>
        ))}
      </ul>
    );
  })();

  const progress = occurrences.data?.length
    ? describeProgress(habitProgress(occurrences.data), "feitos")
    : undefined;

  return (
    <Section title="Hábitos de hoje" progress={progress}>
      {body}
    </Section>
  );
}

function TaskGroup({ title, tasks, today }: { title?: string; tasks: Task[]; today: DateOnly }) {
  if (tasks.length === 0) return null;
  return (
    <div className="grid gap-2">
      {title ? <h3 className="text-sm font-medium text-destructive">{title}</h3> : null}
      <ul className="grid gap-2">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} today={today} showActions={false} />
        ))}
      </ul>
    </div>
  );
}

function TasksSection({ today, seed }: { today: DateOnly; seed: ServerSeed<Task[]> }) {
  const tasks = useTasks(seed);

  const body = (() => {
    if (tasks.isError && !tasks.data) {
      return <SectionError what="as tarefas" onRetry={() => tasks.refetch()} />;
    }
    if (!tasks.data) return <ListSkeleton label="Carregando tarefas" />;

    const selected = selectTodayTasks(tasks.data, today);
    if (selected.overdue.length + selected.dueToday.length === 0) {
      return (
        <EmptyState
          icon={CircleCheckBigIcon}
          title="Nenhuma tarefa para hoje"
          description="Tarefas com prazo para hoje ou atrasadas aparecem aqui."
        />
      );
    }
    return (
      <div className="grid gap-4">
        <TaskGroup title="Atrasadas" tasks={selected.overdue} today={today} />
        <TaskGroup tasks={selected.dueToday} today={today} />
      </div>
    );
  })();

  const progress = tasks.data ? taskProgress(selectTodayTasks(tasks.data, today)) : undefined;

  return (
    <Section
      title="Tarefas de hoje"
      progress={progress?.total ? describeProgress(progress, "feitas") : undefined}
    >
      {body}
      <Button
        variant="link"
        className="justify-self-start px-0"
        nativeButton={false}
        render={<Link href="/tasks" />}
      >
        Ver todas as tarefas
      </Button>
    </Section>
  );
}

/**
 * The Today screen. Phones and tablets get one column: calendar, lists, then the dashboards. From `lg` the
 * lists and the calendar sit side by side (the calendar comes first in the DOM, placed on the right) with the
 * dashboards below at full width.
 */
export function TodayView({
  today,
  tasksSeed,
  occurrencesSeed,
  calendarSeed,
  statsSeed,
}: TodayViewProps) {
  return (
    <>
      <PageHeader title="Hoje" description={capitalize(formatDateWithWeekday(today))} />
      <div className="grid min-w-0 gap-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <section aria-label="Calendário" className="min-w-0 lg:col-start-2 lg:row-start-1">
            {/* Keyed by the day so the selected day and month start over after midnight. */}
            <HabitCalendar key={today} today={today} seed={calendarSeed} />
          </section>
          <div className="grid min-w-0 content-start gap-8 lg:col-start-1 lg:row-start-1">
            <HabitsSection today={today} seed={occurrencesSeed} />
            <TasksSection today={today} seed={tasksSeed} />
          </div>
        </div>
        <Dashboards
          today={today}
          tasksSeed={tasksSeed}
          occurrencesSeed={occurrencesSeed}
          statsSeed={statsSeed}
        />
      </div>
    </>
  );
}
