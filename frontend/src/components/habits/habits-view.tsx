"use client";

import { PlusIcon, RepeatIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api/browser";
import type { DateOnly } from "@/lib/dates";
import { useDeleteHabit, useHabits, type Habit } from "@/lib/habits/hooks";
import type { ServerSeed } from "@/lib/query-seed";
import { ChangeRecurrenceDialog } from "./change-recurrence-dialog";
import { CreateHabitDialog } from "./create-habit-dialog";
import { EditHabitDialog } from "./edit-habit-dialog";
import { HabitCard } from "./habit-card";
import { HabitsSkeleton } from "./habits-skeleton";

type HabitsViewProps = {
  seed?: ServerSeed<Habit[]>;
  /** Brasília date from the server. */
  today: DateOnly;
};

type Dialog =
  | { kind: "create" }
  | { kind: "edit"; habit: Habit }
  | { kind: "recurrence"; habit: Habit }
  | { kind: "delete"; habit: Habit };

export function HabitsView({ seed, today }: HabitsViewProps) {
  const habitsQuery = useHabits(seed);
  const deleteHabit = useDeleteHabit();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const closeDialog = () => setDialog(null);

  const confirmDelete = (habit: Habit) =>
    deleteHabit.mutate(habit.id, {
      onSuccess: () => {
        toast.success("Hábito excluído.");
        closeDialog();
      },
      onError: (error) => toast.error(errorMessage(error, "Não foi possível excluir o hábito.")),
    });

  return (
    <>
      <PageHeader title="Hábitos" description="O que você quer repetir.">
        <Button className="h-11 sm:h-8" onClick={() => setDialog({ kind: "create" })}>
          <PlusIcon aria-hidden />
          Novo hábito
        </Button>
      </PageHeader>

      <HabitsContent
        query={habitsQuery}
        today={today}
        onEdit={(habit) => setDialog({ kind: "edit", habit })}
        onChangeRecurrence={(habit) => setDialog({ kind: "recurrence", habit })}
        onDelete={(habit) => setDialog({ kind: "delete", habit })}
      />

      {dialog?.kind === "create" ? <CreateHabitDialog today={today} onClose={closeDialog} /> : null}
      {dialog?.kind === "edit" ? (
        <EditHabitDialog habit={dialog.habit} onClose={closeDialog} />
      ) : null}
      {dialog?.kind === "recurrence" ? (
        <ChangeRecurrenceDialog habit={dialog.habit} today={today} onClose={closeDialog} />
      ) : null}
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => (open ? undefined : closeDialog())}
        title="Excluir hábito?"
        description={
          dialog?.kind === "delete"
            ? `“${dialog.habit.title}” será excluído junto com todo o histórico: os dias concluídos e não concluídos também serão apagados. Essa ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir"
        pendingLabel="Excluindo…"
        pending={deleteHabit.isPending}
        onConfirm={() => (dialog?.kind === "delete" ? confirmDelete(dialog.habit) : undefined)}
      />
    </>
  );
}

type HabitsContentProps = {
  query: ReturnType<typeof useHabits>;
  today: DateOnly;
  onEdit: (habit: Habit) => void;
  onChangeRecurrence: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
};

function HabitsContent({ query, today, ...actions }: HabitsContentProps) {
  if (query.data === undefined && query.isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center"
      >
        <TriangleAlertIcon className="size-8 text-destructive" aria-hidden />
        <p className="font-medium">Não foi possível carregar seus hábitos.</p>
        <p className="max-w-sm text-sm text-muted-foreground">{errorMessage(query.error)}</p>
        <Button variant="outline" className="h-11 sm:h-8" onClick={() => query.refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (query.data === undefined) return <HabitsSkeleton />;
  if (query.data.length === 0) {
    return (
      <EmptyState
        icon={RepeatIcon}
        title="Nenhum hábito ainda"
        description="Crie um hábito e escolha com que frequência ele se repete: todo dia, só em alguns dias da semana, uma vez por mês…"
      />
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2" aria-label="Seus hábitos">
      {query.data.map((habit) => (
        <li key={habit.id} className="grid">
          <HabitCard habit={habit} today={today} {...actions} />
        </li>
      ))}
    </ul>
  );
}
