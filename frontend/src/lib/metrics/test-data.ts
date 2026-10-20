/** Builders for the metrics tests. */
import type { DateOnly } from "@/lib/dates";
import type { Occurrence } from "@/lib/habits/occurrences";
import type { Task } from "@/lib/tasks/hooks";

export const TODAY: DateOnly = "2026-10-17"; // a Saturday

let nextId = 1;

export function task(overrides: Partial<Task> = {}): Task {
  const id = nextId++;
  return {
    id,
    title: `Tarefa ${id}`,
    description: null,
    dueDate: null,
    status: "Pending",
    createdOn: null,
    completedOn: null,
    ...overrides,
  };
}

/** A completed task; `due` is a day or `null`. */
export function done(completedOn: DateOnly, due: DateOnly | null = null): Task {
  return task({
    status: "Completed",
    completedOn,
    dueDate: due === null ? null : `${due}T00:00:00`,
  });
}

export function pending(due: DateOnly | null): Task {
  return task({ dueDate: due === null ? null : `${due}T00:00:00` });
}

export function occurrence(
  habitId: number,
  day: DateOnly,
  status: Occurrence["status"] = "Completed",
  habitTitle = `Hábito ${habitId}`,
): Occurrence {
  return { id: nextId++, habitId, habitTitle, date: `${day}T00:00:00`, status };
}
