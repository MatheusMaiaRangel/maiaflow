import { dateOnly, type DateOnly } from "@/lib/dates";
import type { Occurrence } from "@/lib/habits/occurrences";
import type { Task } from "@/lib/tasks/hooks";

export type TodayTasks = {
  /** Still pending and due before today. */
  overdue: Task[];
  /** Due today, whatever their status (so a finished task stays visible until tomorrow). */
  dueToday: Task[];
};

function byDueDateThenId(a: Task, b: Task): number {
  const dueA = a.dueDate ? dateOnly(a.dueDate) : "";
  const dueB = b.dueDate ? dateOnly(b.dueDate) : "";
  return dueA === dueB ? a.id - b.id : dueA < dueB ? -1 : 1;
}

/** The tasks that belong on the Today screen. Tasks with no due date are not "for today". */
export function selectTodayTasks(tasks: readonly Task[], today: DateOnly): TodayTasks {
  const overdue: Task[] = [];
  const dueToday: Task[] = [];

  for (const task of tasks) {
    if (!task.dueDate) continue;
    const due = dateOnly(task.dueDate);
    if (due === today) dueToday.push(task);
    else if (due < today && task.status === "Pending") overdue.push(task);
  }

  return {
    overdue: overdue.toSorted(byDueDateThenId),
    dueToday: dueToday.toSorted(byDueDateThenId),
  };
}

export type Progress = { done: number; total: number };

export function habitProgress(occurrences: readonly Occurrence[]): Progress {
  return {
    done: occurrences.filter((occurrence) => occurrence.status === "Completed").length,
    total: occurrences.length,
  };
}

export function taskProgress({ overdue, dueToday }: TodayTasks): Progress {
  return {
    done: dueToday.filter((task) => task.status === "Completed").length,
    total: overdue.length + dueToday.length,
  };
}
