import { AlertCircleIcon, CircleCheckBigIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { TaskFilter } from "@/lib/tasks/view";

const SKELETON_ROWS = 4;

export function TaskListSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando tarefas" className="grid gap-2">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton key={index} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}

const EMPTY_MESSAGES: Record<TaskFilter, { title: string; description: string }> = {
  all: {
    title: "Nenhuma tarefa ainda",
    description: 'Toque em "Nova tarefa" para criar a primeira.',
  },
  Pending: {
    title: "Nenhuma tarefa pendente",
    description: "Tudo em dia por aqui.",
  },
  Completed: {
    title: "Nenhuma tarefa concluída",
    description: "As tarefas que você concluir aparecem aqui.",
  },
  NotCompleted: {
    title: "Nenhuma tarefa não concluída",
    description: "As tarefas que você marcar como não concluídas aparecem aqui.",
  },
};

export function TasksEmptyState({ filter }: { filter: TaskFilter }) {
  return <EmptyState icon={CircleCheckBigIcon} {...EMPTY_MESSAGES[filter]} />;
}

export function TasksError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center"
    >
      <AlertCircleIcon className="size-8 text-destructive" aria-hidden />
      <p className="font-medium">Não foi possível carregar as tarefas</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Verifique sua conexão e tente novamente.
      </p>
      <Button variant="outline" onClick={onRetry} disabled={retrying}>
        Tentar novamente
      </Button>
    </div>
  );
}
