import { describe, expect, it } from "vitest";
import type { Task } from "./hooks";
import { countTasks, dueState, filterTasks, isTaskFilter, sortTasks } from "./view";

const TODAY = "2026-10-14";

function task(overrides: Partial<Task> & { id: number }): Task {
  return {
    title: `Tarefa ${overrides.id}`,
    description: null,
    dueDate: null,
    status: "Pending",
    ...overrides,
  };
}

describe("sortTasks", () => {
  it("puts pending first by due date, undated last, then not completed, then completed", () => {
    const tasks = [
      task({ id: 1, status: "Completed", dueDate: "2026-10-01T00:00:00" }),
      task({ id: 2, dueDate: null }),
      task({ id: 3, dueDate: "2026-10-20T00:00:00" }),
      task({ id: 4, status: "NotCompleted", dueDate: "2026-10-02T00:00:00" }),
      task({ id: 5, dueDate: "2026-10-10T00:00:00" }),
    ];

    expect(sortTasks(tasks).map((t) => t.id)).toEqual([5, 3, 2, 4, 1]);
  });

  it("shows the newest first among tasks with the same due date", () => {
    const tasks = [task({ id: 1 }), task({ id: 9 }), task({ id: 4 })];

    expect(sortTasks(tasks).map((t) => t.id)).toEqual([9, 4, 1]);
  });

  it("does not change the original list", () => {
    const tasks = [task({ id: 1 }), task({ id: 2, dueDate: "2026-10-10T00:00:00" })];

    sortTasks(tasks);

    expect(tasks.map((t) => t.id)).toEqual([1, 2]);
  });
});

describe("filterTasks and countTasks", () => {
  const tasks = [
    task({ id: 1 }),
    task({ id: 2, status: "Completed" }),
    task({ id: 3, status: "Completed" }),
    task({ id: 4, status: "NotCompleted" }),
  ];

  it("filters by status and keeps everything for 'all'", () => {
    expect(filterTasks(tasks, "all")).toHaveLength(4);
    expect(filterTasks(tasks, "Completed").map((t) => t.id)).toEqual([2, 3]);
    expect(filterTasks(tasks, "NotCompleted").map((t) => t.id)).toEqual([4]);
  });

  it("counts tasks per filter", () => {
    expect(countTasks(tasks)).toEqual({ all: 4, Pending: 1, Completed: 2, NotCompleted: 1 });
  });

  it("recognises valid filters only", () => {
    expect(isTaskFilter("Pending")).toBe(true);
    expect(isTaskFilter("Done")).toBe(false);
  });
});

describe("dueState", () => {
  it("is overdue for a pending task due before today", () => {
    expect(dueState(task({ id: 1, dueDate: "2026-10-13T00:00:00" }), TODAY)).toBe("overdue");
  });

  it("is today for a pending task due today", () => {
    expect(dueState(task({ id: 1, dueDate: "2026-10-14T00:00:00" }), TODAY)).toBe("today");
  });

  it("is later for a future date", () => {
    expect(dueState(task({ id: 1, dueDate: "2026-10-15T00:00:00" }), TODAY)).toBe("later");
  });

  it("is none without a due date", () => {
    expect(dueState(task({ id: 1 }), TODAY)).toBe("none");
  });

  it("is never overdue once the task is completed or not completed", () => {
    const past = "2026-10-01T00:00:00";
    expect(dueState(task({ id: 1, dueDate: past, status: "Completed" }), TODAY)).toBe("later");
    expect(dueState(task({ id: 1, dueDate: past, status: "NotCompleted" }), TODAY)).toBe("later");
  });
});
