"use client";

import { PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import type { DateOnly } from "@/lib/dates";
import type { ServerSeed } from "@/lib/query-seed";
import { useDeleteTask, useTasks, type Task } from "@/lib/tasks/hooks";
import { countTasks, filterTasks, sortTasks, type TaskFilter } from "@/lib/tasks/view";
import { TaskFilterTabs } from "./task-filter-tabs";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskListSkeleton, TasksEmptyState, TasksError } from "./task-list-states";
import { TaskRow } from "./task-row";

type TasksViewProps = {
  /** Tasks the server already fetched, so the first paint needs no request. Without it the list loads in the browser. */
  seed?: ServerSeed<Task[]>;
  /** Today in Brasília (`yyyy-MM-dd`), from the server. */
  today: DateOnly;
};

/** The whole /tasks screen: header, status filter, list, and the create / edit / delete dialogs. */
export function TasksView({ seed, today }: TasksViewProps) {
  const { data: tasks, isPending, isError, isFetching, refetch } = useTasks(seed);
  const deleteTask = useDeleteTask();
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const counts = useMemo(() => countTasks(tasks ?? []), [tasks]);
  const visible = useMemo(() => sortTasks(filterTasks(tasks ?? [], filter)), [tasks, filter]);

  const openCreate = () => {
    setEditing(null);
    setIsFormOpen(true);
  };
  const openEdit = (task: Task) => {
    setEditing(task);
    setIsFormOpen(true);
  };
  const confirmDelete = () => {
    if (!deleting) return;
    deleteTask.mutate(deleting.id);
    setDeleting(null);
  };

  return (
    <>
      <PageHeader title="Tarefas" description="Tudo o que você precisa fazer.">
        <Button size="lg" onClick={openCreate} className="h-10 sm:h-9">
          <PlusIcon aria-hidden /> Nova tarefa
        </Button>
      </PageHeader>

      {isPending ? <TaskListSkeleton /> : null}
      {!isPending && !tasks ? (
        <TasksError onRetry={() => void refetch()} retrying={isFetching} />
      ) : null}
      {tasks ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {isError ? <TasksError onRetry={() => void refetch()} retrying={isFetching} /> : null}
          <TaskFilterTabs value={filter} counts={counts} onChange={setFilter} />
          {visible.length === 0 ? (
            <TasksEmptyState filter={filter} />
          ) : (
            <ul className="grid gap-2" aria-label="Lista de tarefas">
              {visible.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  onEdit={openEdit}
                  onDelete={setDeleting}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <TaskFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} task={editing} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir tarefa?"
        description={
          deleting ? `"${deleting.title}" será excluída. Essa ação não pode ser desfeita.` : null
        }
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
      />
    </>
  );
}
