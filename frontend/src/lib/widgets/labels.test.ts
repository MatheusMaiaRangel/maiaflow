import { describe, expect, it } from "vitest";
import { VARIABLES } from "@/lib/metrics/types";
import {
  autoLabel,
  CHART_LABELS,
  COUNT_VARIABLE_GROUPS,
  isCountVariable,
  PERIOD_OPTIONS,
  periodFromValue,
  periodValue,
  VARIABLE_GROUPS,
} from "./labels";
import { CHART_TYPES, MAX_LABEL_LENGTH } from "./config";

describe("labels", () => {
  it("names every chart type", () => {
    expect(CHART_TYPES.every((chart) => CHART_LABELS[chart].length > 0)).toBe(true);
  });

  it("lists every variable once, grouped by source", () => {
    const listed = VARIABLE_GROUPS.flatMap((group) => group.options.map(({ value }) => value));
    expect(listed.toSorted()).toEqual([...VARIABLES].toSorted());
  });

  it("offers only counts as divisors", () => {
    const divisors = COUNT_VARIABLE_GROUPS.flatMap((group) =>
      group.options.map(({ value }) => value),
    );
    expect(divisors).not.toContain("habits.completionRate");
    expect(divisors).not.toContain("habits.currentStreak");
    expect(divisors).toContain("habits.scheduled");
    expect(isCountVariable("tasks.created")).toBe(true);
  });

  it("names a series after its metric", () => {
    expect(autoLabel({ variable: "tasks.completed" })).toBe("Tarefas concluídas");
    const ratio = autoLabel({
      variable: "tasks.completedOnTime",
      divideBy: "tasks.completedWithDueDate",
    });
    expect(ratio.length).toBeLessThanOrEqual(MAX_LABEL_LENGTH);
    expect(ratio.endsWith("…")).toBe(true);
    expect(autoLabel({ variable: "habits.completed", divideBy: "habits.scheduled" })).toBe(
      "Hábitos feitos ÷ Hábitos previstos",
    );
  });
});

describe("periods", () => {
  const today = "2026-10-19";

  it("round-trips every preset", () => {
    for (const { value } of PERIOD_OPTIONS.filter(({ value }) => value !== "custom")) {
      expect(periodValue(periodFromValue(value, { kind: "last", days: 7 }, today as never))).toBe(
        value,
      );
    }
  });

  it("starts a custom period as the last 30 days and keeps an existing one", () => {
    expect(periodFromValue("custom", { kind: "last", days: 7 }, today as never)).toEqual({
      kind: "custom",
      from: "2026-09-20",
      to: "2026-10-19",
    });
    const custom = { kind: "custom", from: "2026-01-01", to: "2026-01-31" } as const;
    expect(periodFromValue("custom", custom as never, today as never)).toBe(custom);
    expect(periodValue(custom as never)).toBe("custom");
  });

  it("keeps the current period for unknown values", () => {
    const current = { kind: "next", days: 30 } as const;
    expect(periodFromValue("last-14", current, today as never)).toBe(current);
    expect(periodFromValue("soon-7", current, today as never)).toBe(current);
  });
});
