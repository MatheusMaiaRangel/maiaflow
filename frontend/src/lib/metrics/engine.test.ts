import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { computeMetrics, needsTasks, queryErrors, requiredHabitRange } from "./engine";
import { done, occurrence, pending, task, TODAY } from "./test-data";
import type { MetricData, MetricQuery } from "./types";

const yesterday = addDays(TODAY, -1);

function query(overrides: Partial<MetricQuery> = {}): MetricQuery {
  return {
    metrics: [{ variable: "tasks.completed" }],
    grouping: "none",
    period: { kind: "last", days: 7 },
    habitFilter: { kind: "all" },
    ...overrides,
  };
}

function data(overrides: Partial<MetricData> = {}): MetricData {
  return { tasks: [], occurrences: [], today: TODAY, ...overrides };
}

describe("queryErrors", () => {
  it("accepts a valid query", () => {
    expect(queryErrors(query())).toEqual([]);
  });

  it("needs at least one known metric", () => {
    expect(queryErrors(query({ metrics: [] }))).toEqual(["Escolha pelo menos uma métrica."]);
    expect(
      queryErrors(query({ metrics: [{ variable: "tasks.nope" as "tasks.created" }] })),
    ).toEqual(["Métrica desconhecida."]);
  });

  it("rejects unknown groupings, bad periods and bad habit ids", () => {
    expect(queryErrors(query({ grouping: "month" as "day" }))).toEqual([
      "Agrupamento desconhecido.",
    ]);
    expect(
      queryErrors(query({ period: { kind: "custom", from: "2026-10-17", to: "2026-10-01" } })),
    ).toEqual(["A data final deve ser depois da inicial."]);
    expect(queryErrors(query({ habitFilter: { kind: "habit", habitId: 0 } }))).toEqual([
      "Hábito inválido.",
    ]);
  });

  it("only groups habit metrics by habit", () => {
    expect(queryErrors(query({ grouping: "habit" }))).toEqual([
      "Agrupar por hábito só funciona com métricas de hábitos.",
    ]);
    expect(
      queryErrors(query({ grouping: "habit", metrics: [{ variable: "habits.completed" }] })),
    ).toEqual([]);
  });

  it("only shows the streak as a total or per habit", () => {
    const streak = { metrics: [{ variable: "habits.currentStreak" as const }] };
    expect(queryErrors(query({ ...streak, grouping: "day" }))).toEqual([
      "A sequência atual só pode ser vista no total ou por hábito.",
    ]);
    expect(queryErrors(query({ ...streak, grouping: "habit" }))).toEqual([]);
  });

  it("only divides counts", () => {
    expect(
      queryErrors(
        query({ metrics: [{ variable: "tasks.completed", divideBy: "habits.completionRate" }] }),
      ),
    ).toEqual(["A divisão só aceita contagens."]);
  });
});

describe("requiredHabitRange and needsTasks", () => {
  it("needs no habits for task-only queries", () => {
    expect(requiredHabitRange(query(), TODAY)).toBeNull();
    expect(needsTasks(query())).toBe(true);
  });

  it("needs the period for habit counts and the year back for the streak", () => {
    const counts = query({ metrics: [{ variable: "habits.completed" }] });
    expect(requiredHabitRange(counts, TODAY)).toEqual({ from: "2026-10-11", to: TODAY });
    expect(needsTasks(counts)).toBe(false);

    const streak = query({
      metrics: [{ variable: "habits.currentStreak" }],
      period: { kind: "next", days: 7 },
    });
    expect(requiredHabitRange(streak, TODAY)).toEqual({
      from: addDays(TODAY, -364),
      to: addDays(TODAY, 6),
    });
  });

  it("looks at the denominator too", () => {
    const mixed = query({
      metrics: [{ variable: "tasks.completed", divideBy: "habits.completed" }],
    });
    expect(requiredHabitRange(mixed, TODAY)).not.toBeNull();
    expect(needsTasks(mixed)).toBe(true);
  });
});

describe("computeMetrics with tasks", () => {
  it("throws on an invalid query", () => {
    expect(() => computeMetrics(query({ metrics: [] }), data())).toThrow(RangeError);
  });

  it("counts completed tasks per day inside the period only", () => {
    const tasks = [done(TODAY), done(TODAY), done(yesterday), done(addDays(TODAY, -7))];

    const result = computeMetrics(query({ grouping: "day" }), data({ tasks }));

    expect(result.range).toEqual({ from: "2026-10-11", to: TODAY });
    expect(result.buckets).toHaveLength(7);
    expect(result.series[0]).toEqual({ unit: "count", values: [0, 0, 0, 0, 0, 1, 2] });
  });

  it("returns one series per metric", () => {
    const tasks = [done(TODAY), task({ createdOn: TODAY }), task({ createdOn: yesterday })];

    const result = computeMetrics(
      query({ metrics: [{ variable: "tasks.completed" }, { variable: "tasks.created" }] }),
      data({ tasks }),
    );

    expect(result.series.map((series) => series.values)).toEqual([[1], [2]]);
  });

  it("counts open tasks as they are now when there is no grouping, whatever the period", () => {
    const tasks = [pending(addDays(TODAY, -40)), pending(yesterday), pending(null), pending(TODAY)];

    const result = computeMetrics(
      query({
        metrics: [
          { variable: "tasks.openOverdue" },
          { variable: "tasks.openWithoutDueDate" },
          { variable: "tasks.openPending" },
        ],
      }),
      data({ tasks }),
    );

    expect(result.series.map((series) => series.values[0])).toEqual([2, 1, 1]);
  });

  it("places open tasks on their due day for time groupings, leaving out those without one", () => {
    const tasks = [
      pending(TODAY),
      pending(addDays(TODAY, 2)),
      pending(addDays(TODAY, 30)),
      pending(null),
    ];

    const result = computeMetrics(
      query({
        metrics: [{ variable: "tasks.openPending" }],
        grouping: "day",
        period: { kind: "next", days: 7 },
      }),
      data({ tasks }),
    );

    expect(result.buckets[0].key).toBe(TODAY);
    expect(result.series[0].values).toEqual([1, 0, 1, 0, 0, 0, 0]);
  });

  it("groups by week and weekday", () => {
    // 2026-10-11 is a Sunday.
    const tasks = [done("2026-10-11"), done("2026-10-12"), done("2026-10-18"), done("2026-10-25")];
    const period = { kind: "custom", from: "2026-10-11", to: "2026-10-24" } as const;

    const weeks = computeMetrics(query({ grouping: "week", period }), data({ tasks }));
    const weekdays = computeMetrics(query({ grouping: "weekday", period }), data({ tasks }));

    expect(weeks.series[0].values).toEqual([2, 1]);
    expect(weekdays.series[0].values).toEqual([2, 1, 0, 0, 0, 0, 0]);
  });

  it("divides A by B in percent, with the counts and null when B is zero", () => {
    const tasks = [
      done(TODAY, TODAY),
      done(TODAY, "2026-10-10"),
      done(yesterday, "2026-10-20"),
      done(addDays(TODAY, -2)),
    ];

    const result = computeMetrics(
      query({
        metrics: [{ variable: "tasks.completedOnTime", divideBy: "tasks.completedWithDueDate" }],
        grouping: "day",
        period: { kind: "last", days: 7 },
      }),
      data({ tasks }),
    );

    const series = result.series[0];
    expect(series.unit).toBe("percent");
    expect(series.values.slice(-3)).toEqual([null, 100, 50]);
    expect(series.parts?.numerator.slice(-3)).toEqual([0, 1, 1]);
    expect(series.parts?.denominator.slice(-3)).toEqual([0, 1, 2]);
  });
});

describe("computeMetrics with habits", () => {
  const occurrences = [
    occurrence(1, addDays(TODAY, -2), "Completed", "Correr"),
    occurrence(1, yesterday, "NotCompleted", "Correr"),
    occurrence(1, TODAY, "Pending", "Correr"),
    occurrence(2, addDays(TODAY, -2), "Completed", "Ler"),
    occurrence(2, yesterday, "Completed", "Ler"),
    occurrence(2, TODAY, "Completed", "Ler"),
    occurrence(2, addDays(TODAY, -20), "Pending", "Ler"),
  ];

  it("counts occurrences by status per day", () => {
    const result = computeMetrics(
      query({
        metrics: [
          { variable: "habits.completed" },
          { variable: "habits.notCompleted" },
          { variable: "habits.pending" },
          { variable: "habits.scheduled" },
        ],
        grouping: "day",
      }),
      data({ occurrences }),
    );

    expect(result.series.map((series) => series.values.slice(-3))).toEqual([
      [2, 1, 1],
      [0, 1, 0],
      [0, 0, 1],
      [2, 2, 2],
    ]);
  });

  it("filters one habit", () => {
    const result = computeMetrics(
      query({
        metrics: [{ variable: "habits.completed" }],
        habitFilter: { kind: "habit", habitId: 1 },
      }),
      data({ occurrences }),
    );
    expect(result.series[0].values).toEqual([1]);
  });

  it("computes the completion rate, leaving out today's pending occurrence", () => {
    const result = computeMetrics(
      query({ metrics: [{ variable: "habits.completionRate" }], grouping: "day" }),
      data({ occurrences }),
    );

    expect(result.series[0].unit).toBe("percent");
    expect(result.series[0].values.slice(-4)).toEqual([null, 100, 50, 100]);
  });

  it("counts a past pending occurrence as a miss in the rate", () => {
    const result = computeMetrics(
      query({
        metrics: [{ variable: "habits.completionRate" }],
        period: { kind: "last", days: 30 },
      }),
      data({ occurrences }),
    );
    // 4 done out of 6 counted (today's pending left out, the pending of 20 days ago counted).
    expect(result.series[0].values[0]).toBeCloseTo((4 / 6) * 100);
  });

  it("groups by habit, ordered by id, with the rate and the streak", () => {
    const result = computeMetrics(
      query({
        metrics: [{ variable: "habits.completionRate" }, { variable: "habits.currentStreak" }],
        grouping: "habit",
      }),
      data({ occurrences }),
    );

    expect(result.buckets.map((bucket) => bucket.label)).toEqual(["Correr", "Ler"]);
    expect(result.series[0].values).toEqual([50, 100]);
    expect(result.series[1]).toEqual({ unit: "streak", values: [0, 3] });
  });

  it("lists habits that have occurrences only before the period when the streak needs them", () => {
    const old = [...occurrences, occurrence(3, addDays(TODAY, -100), "Completed", "Meditar")];
    const result = computeMetrics(
      query({
        metrics: [{ variable: "habits.completed" }, { variable: "habits.currentStreak" }],
        grouping: "habit",
      }),
      data({ occurrences: old }),
    );
    expect(result.buckets.map((bucket) => bucket.label)).toEqual(["Correr", "Ler", "Meditar"]);
    expect(result.series[0].values).toEqual([1, 3, 0]);
  });

  it("shows the best current streak as the total", () => {
    const result = computeMetrics(
      query({ metrics: [{ variable: "habits.currentStreak" }] }),
      data({ occurrences }),
    );
    expect(result.series[0].values).toEqual([3]);
  });

  it("has a zero streak and a null rate with no habits", () => {
    const result = computeMetrics(
      query({
        metrics: [{ variable: "habits.currentStreak" }, { variable: "habits.completionRate" }],
      }),
      data(),
    );
    expect(result.series.map((series) => series.values)).toEqual([[0], [null]]);
  });

  it("has no buckets when grouping by habit without habits", () => {
    const result = computeMetrics(
      query({ metrics: [{ variable: "habits.completed" }], grouping: "habit" }),
      data(),
    );
    expect(result.buckets).toEqual([]);
    expect(result.series[0].values).toEqual([]);
  });

  it("divides habit counts too", () => {
    const result = computeMetrics(
      query({ metrics: [{ variable: "habits.completed", divideBy: "habits.scheduled" }] }),
      data({ occurrences }),
    );
    expect(result.series[0].values[0]).toBeCloseTo((4 / 6) * 100);
  });
});
