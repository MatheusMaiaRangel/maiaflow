"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { DateOnly } from "@/lib/dates";
import { useSetTaskStatus, type Task } from "@/lib/tasks/hooks";
import { DueBadge } from "./due-badge";
import { TaskActionsMenu } from "./task-actions-menu";

export type TaskRowProps = {
  task: Task;
  /** Today in Brasília (`yyyy-MM-dd`), computed on the server; decides "Atrasada" / "Hoje". */
  today: DateOnly;
  /** Show the "⋮" menu (default). The Today page passes `false` for a plain row. */
  showActions?: boolean;
  /** Adds "Editar" to the menu. */
  onEdit?: (task: Task) => void;
  /** Adds "Excluir" to the menu. */
  onDelete?: (task: Task) => void;
};

/**
 * One task as a list item (render it inside a `<ul>`): checkbox to complete / undo (optimistic, error
 * toast on failure), title, description, due-date badge and, optionally, the actions menu.
 */
export function TaskRow({ task, today, showActions = true, onEdit, onDelete }: TaskRowProps) {
  const { mutate: setStatus } = useSetTaskStatus();
  const isCompleted = task.status === "Completed";
  const isNotCompleted = task.status === "NotCompleted";

  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card px-3 py-3 text-card-foreground">
      <Checkbox
        className="mt-0.5 size-5 after:-inset-3"
        checked={isCompleted}
        onCheckedChange={(checked) =>
          setStatus({ id: task.id, status: checked ? "Completed" : "Pending" })
        }
        aria-label={task.title}
      />
      <div className="grid min-w-0 flex-1 gap-1">
        <p
          className={cn(
            "text-sm font-medium break-words",
            (isCompleted || isNotCompleted) && "text-muted-foreground",
            isCompleted && "line-through",
          )}
        >
          {task.title}
        </p>
        {task.description ? (
          <p className="line-clamp-2 text-sm break-words text-muted-foreground">
            {task.description}
          </p>
        ) : null}
        {task.dueDate || isNotCompleted ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <DueBadge task={task} today={today} />
            {isNotCompleted ? <Badge variant="secondary">Não concluída</Badge> : null}
          </div>
        ) : null}
      </div>
      {showActions ? (
        <TaskActionsMenu
          task={task}
          onSetStatus={(status) => setStatus({ id: task.id, status })}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : null}
    </li>
  );
}
