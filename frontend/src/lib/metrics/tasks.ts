/**
 * Where each task variable places a task. Tasks carry `createdOn` and `completedOn` since D25; tasks from
 * before that have them empty and are simply not counted by the variables that need them.
 */
import { dateOnly, type DateOnly } from "@/lib/dates";
import type { Task } from "@/lib/tasks/hooks";
import type { TaskVariable } from "./types";

/** Not counted by the variable. */
export const SKIP = undefined;

/**
 * The day a task counts on for `variable`: a day, `null` when it counts but has no day (a pending task
 * without a due date), or `undefined` when the variable does not count it at all.
 */
export function taskDay(
  variable: TaskVariable,
  task: Task,
  today: DateOnly,
): DateOnly | null | undefined {
  const due = task.dueDate === null ? null : dateOnly(task.dueDate);
  const completedOn = task.status === "Completed" ? task.completedOn : null;
  const isPending = task.status === "Pending";

  switch (variable) {
    case "tasks.created":
      return task.createdOn ?? SKIP;
    case "tasks.completed":
      return completedOn ?? SKIP;
    case "tasks.completedOnTime":
      return completedOn !== null && due !== null && completedOn <= due ? completedOn : SKIP;
    case "tasks.completedLate":
      return completedOn !== null && due !== null && completedOn > due ? completedOn : SKIP;
    case "tasks.completedWithDueDate":
      return completedOn !== null && due !== null ? completedOn : SKIP;
    case "tasks.completedWithoutDueDate":
      return completedOn !== null && due === null ? completedOn : SKIP;
    case "tasks.openPending":
      return isPending && due !== null && due >= today ? due : SKIP;
    case "tasks.openOverdue":
      return isPending && due !== null && due < today ? due : SKIP;
    case "tasks.openWithoutDueDate":
      return isPending && due === null ? null : SKIP;
  }
}
