import { describe, expect, it } from "vitest";
import type { Occurrence } from "@/lib/habits/occurrences";
import type { Task } from "@/lib/tasks/hooks";
import { habitProgress, selectTodayTasks, taskProgress } from "./today";

const TODAY = "2026-10-14";

function task(id: number, dueDate: string | null, status: Task["status"] = "Pending"): Task {
  return { id, title: `Tarefa ${id}`, description: null, dueDate, status };
}

function occurrence(id: number, status: Occurrence["status"]): Occurrence {
  return { id, habitId: id, habitTitle: `Hábito ${id}`, date: `${TODAY}T00:00:00`, status };
}

describe("selectTodayTasks", () => {
  it("separates overdue pending tasks from tasks due today", () => {
    const tasks = [
      task(1, "2026-10-13T00:00:00"),
      task(2, "2026-10-14T00:00:00"),
      task(3, "2026-10-15T00:00:00"),
    ];

    const result = selectTodayTasks(tasks, TODAY);

    expect(result.overdue.map((t) => t.id)).toEqual([1]);
    expect(result.dueToday.map((t) => t.id)).toEqual([2]);
  });

  it("leaves out tasks without a due date", () => {
    const result = selectTodayTasks([task(1, null)], TODAY);

    expect(result).toEqual({ overdue: [], dueToday: [] });
  });

  it("hides finished and not-completed tasks from the overdue list", () => {
    const tasks = [
      task(1, "2026-10-10T00:00:00", "Completed"),
      task(2, "2026-10-10T00:00:00", "NotCompleted"),
    ];

    expect(selectTodayTasks(tasks, TODAY).overdue).toEqual([]);
  });

  it("keeps finished tasks that are due today", () => {
    const result = selectTodayTasks([task(1, "2026-10-14T00:00:00", "Completed")], TODAY);

    expect(result.dueToday).toHaveLength(1);
  });

  it("orders overdue tasks from the oldest due date", () => {
    const tasks = [task(1, "2026-10-12T00:00:00"), task(2, "2026-10-10T00:00:00")];

    expect(selectTodayTasks(tasks, TODAY).overdue.map((t) => t.id)).toEqual([2, 1]);
  });

  it("does not change the list it receives", () => {
    const tasks = [task(1, "2026-10-12T00:00:00"), task(2, "2026-10-10T00:00:00")];

    selectTodayTasks(tasks, TODAY);

    expect(tasks.map((t) => t.id)).toEqual([1, 2]);
  });
});

describe("progress", () => {
  it("counts completed habits", () => {
    const occurrences = [
      occurrence(1, "Completed"),
      occurrence(2, "Pending"),
      occurrence(3, "NotCompleted"),
    ];

    expect(habitProgress(occurrences)).toEqual({ done: 1, total: 3 });
  });

  it("counts overdue tasks as open and finished ones due today as done", () => {
    const today = selectTodayTasks(
      [
        task(1, "2026-10-12T00:00:00"),
        task(2, "2026-10-14T00:00:00", "Completed"),
        task(3, "2026-10-14T00:00:00"),
      ],
      TODAY,
    );

    expect(taskProgress(today)).toEqual({ done: 1, total: 3 });
  });
});
