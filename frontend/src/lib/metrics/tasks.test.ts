import { describe, expect, it } from "vitest";
import { taskDay } from "./tasks";
import { done, pending, task, TODAY } from "./test-data";

describe("taskDay", () => {
  it("places created tasks on their creation day and skips tasks without one", () => {
    expect(taskDay("tasks.created", task({ createdOn: "2026-10-10" }), TODAY)).toBe("2026-10-10");
    expect(taskDay("tasks.created", task(), TODAY)).toBeUndefined();
  });

  it("places completed tasks on their completion day", () => {
    expect(taskDay("tasks.completed", done("2026-10-12"), TODAY)).toBe("2026-10-12");
    expect(taskDay("tasks.completed", task({ status: "Completed" }), TODAY)).toBeUndefined();
  });

  it("ignores a stale completion day on a task that is no longer completed", () => {
    const reopened = task({ status: "Pending", completedOn: "2026-10-12" });
    expect(taskDay("tasks.completed", reopened, TODAY)).toBeUndefined();
  });

  it("splits completed tasks by due date", () => {
    const onTime = done("2026-10-12", "2026-10-12");
    const late = done("2026-10-13", "2026-10-12");
    const noDue = done("2026-10-14");

    expect(taskDay("tasks.completedOnTime", onTime, TODAY)).toBe("2026-10-12");
    expect(taskDay("tasks.completedOnTime", late, TODAY)).toBeUndefined();
    expect(taskDay("tasks.completedOnTime", noDue, TODAY)).toBeUndefined();

    expect(taskDay("tasks.completedLate", late, TODAY)).toBe("2026-10-13");
    expect(taskDay("tasks.completedLate", onTime, TODAY)).toBeUndefined();

    expect(taskDay("tasks.completedWithDueDate", onTime, TODAY)).toBe("2026-10-12");
    expect(taskDay("tasks.completedWithDueDate", late, TODAY)).toBe("2026-10-13");
    expect(taskDay("tasks.completedWithDueDate", noDue, TODAY)).toBeUndefined();

    expect(taskDay("tasks.completedWithoutDueDate", noDue, TODAY)).toBe("2026-10-14");
    expect(taskDay("tasks.completedWithoutDueDate", onTime, TODAY)).toBeUndefined();
  });

  it("places open tasks on their due day: today counts as on time, yesterday as overdue", () => {
    expect(taskDay("tasks.openPending", pending(TODAY), TODAY)).toBe(TODAY);
    expect(taskDay("tasks.openPending", pending("2026-10-16"), TODAY)).toBeUndefined();
    expect(taskDay("tasks.openOverdue", pending("2026-10-16"), TODAY)).toBe("2026-10-16");
    expect(taskDay("tasks.openOverdue", pending(TODAY), TODAY)).toBeUndefined();
  });

  it("counts pending tasks without a due date with no day", () => {
    expect(taskDay("tasks.openWithoutDueDate", pending(null), TODAY)).toBeNull();
    expect(taskDay("tasks.openWithoutDueDate", pending(TODAY), TODAY)).toBeUndefined();
    expect(taskDay("tasks.openPending", pending(null), TODAY)).toBeUndefined();
  });

  it("does not count tasks that are not pending as open", () => {
    const notDone = task({ status: "NotCompleted", dueDate: "2026-10-10T00:00:00" });
    expect(taskDay("tasks.openOverdue", notDone, TODAY)).toBeUndefined();
    expect(
      taskDay("tasks.openWithoutDueDate", task({ status: "NotCompleted" }), TODAY),
    ).toBeUndefined();
    expect(taskDay("tasks.openPending", done(TODAY, "2026-10-20"), TODAY)).toBeUndefined();
  });
});
