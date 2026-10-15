import { dateOnly, type DateOnly } from "@/lib/dates";
import type { Task, TaskStatus } from "./hooks";

export type TaskFilter = "all" | TaskStatus;

export const TASK_FILTERS: readonly TaskFilter[] = ["all", "Pending", "Completed", "NotCompleted"];

export const FILTER_LABELS: Record<TaskFilter, string> = {
  all: "Todas",
  Pending: "Pendentes",
  Completed: "Concluídas",
  NotCompleted: "Não concluídas",
};

export function isTaskFilter(value: unknown): value is TaskFilter {
  return TASK_FILTERS.includes(value as TaskFilter);
}

/** Pending first, then the ones marked "not completed", then the completed ones. */
const STATUS_ORDER: Record<TaskStatus, number> = { Pending: 0, NotCompleted: 1, Completed: 2 };

function dueOf(task: Task): DateOnly | null {
  return task.dueDate ? dateOnly(task.dueDate) : null;
}

function compareTasks(a: Task, b: Task): number {
  const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (byStatus !== 0) return byStatus;

  const dueA = dueOf(a);
  const dueB = dueOf(b);
  if (dueA !== dueB) {
    if (dueA === null) return 1; // undated tasks go last
    if (dueB === null) return -1;
    return dueA < dueB ? -1 : 1;
  }
  return b.id - a.id; // newest first
}

/** A sorted copy: pending by due date (undated last), then not completed, then completed. */
export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort(compareTasks);
}

export function filterTasks(tasks: readonly Task[], filter: TaskFilter): Task[] {
  return filter === "all" ? [...tasks] : tasks.filter((task) => task.status === filter);
}

export function countTasks(tasks: readonly Task[]): Record<TaskFilter, number> {
  const counts: Record<TaskFilter, number> = {
    all: tasks.length,
    Pending: 0,
    Completed: 0,
    NotCompleted: 0,
  };
  for (const task of tasks) counts[task.status] += 1;
  return counts;
}

export type DueState = "overdue" | "today" | "later" | "none";

/** Only pending tasks are "overdue" or "today"; a finished task just shows its date. */
export function dueState(task: Task, today: DateOnly): DueState {
  const due = dueOf(task);
  if (due === null) return "none";
  if (task.status !== "Pending") return "later";
  if (due < today) return "overdue";
  return due === today ? "today" : "later";
}
