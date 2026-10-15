"use client";

import { BanIcon, MoreVerticalIcon, PencilIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Task, TaskStatus } from "@/lib/tasks/hooks";

type TaskActionsMenuProps = {
  task: Task;
  onSetStatus: (status: TaskStatus) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
};

/** "⋮" menu of a task: edit, mark as not completed (or reopen), delete. */
export function TaskActionsMenu({ task, onSetStatus, onEdit, onDelete }: TaskActionsMenuProps) {
  const isNotCompleted = task.status === "NotCompleted";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="-my-1 -mr-1 size-10 sm:size-8"
            aria-label={`Ações da tarefa ${task.title}`}
          />
        }
      >
        <MoreVerticalIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {onEdit ? (
          <DropdownMenuItem onClick={() => onEdit(task)}>
            <PencilIcon aria-hidden /> Editar
          </DropdownMenuItem>
        ) : null}
        {isNotCompleted ? (
          <DropdownMenuItem onClick={() => onSetStatus("Pending")}>
            <RotateCcwIcon aria-hidden /> Marcar como pendente
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onSetStatus("NotCompleted")}>
            <BanIcon aria-hidden /> Marcar como não concluída
          </DropdownMenuItem>
        )}
        {onDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}>
              <Trash2Icon aria-hidden /> Excluir
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
