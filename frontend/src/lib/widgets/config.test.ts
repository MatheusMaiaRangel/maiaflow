import { describe, expect, it } from "vitest";
import { cssColor, isColorRef, mixColor } from "./colors";
import { seriesUnit, widgetErrors, widgetQuery, type WidgetConfig } from "./config";
import { DEFAULT_DASHBOARD } from "./default-dashboard";

function widget(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    id: "w",
    title: "Concluídas",
    chart: "bar",
    series: [{ metric: { variable: "tasks.completed" }, label: "Concluídas", color: "blue" }],
    grouping: "day",
    period: { kind: "last", days: 30 },
    habitFilter: { kind: "all" },
    layout: { x: 0, y: 0, w: 2, h: 1 },
    ...overrides,
  };
}

const count = (label = "A") => ({
  metric: { variable: "tasks.completed" as const },
  label,
  color: "blue" as const,
});
const rate = (label = "Taxa") => ({
  metric: { variable: "habits.completionRate" as const },
  label,
  color: "done" as const,
});

describe("colors", () => {
  it("maps palette names to their CSS variables and keeps valid hex colors", () => {
    expect(cssColor("blue")).toBe("var(--viz-blue)");
    expect(cssColor("pending")).toBe("var(--viz-pending)");
    expect(cssColor("#A1b2C3")).toBe("#A1b2C3");
  });

  it("never lets an invalid value reach a style", () => {
    expect(cssColor("red;background:url(x)" as "red")).toBe("var(--viz-blue)");
    expect(isColorRef("#abc")).toBe(false);
    expect(isColorRef("#abcdef")).toBe(true);
    expect(isColorRef("violet")).toBe(true);
    expect(isColorRef(42)).toBe(false);
  });

  it("mixes a color into a base, clamping the share", () => {
    expect(mixColor("blue", 30)).toBe("color-mix(in oklab, var(--viz-blue) 30%, var(--card))");
    expect(mixColor("#000000", 140, "white")).toBe("color-mix(in oklab, #000000 100%, white)");
    expect(mixColor("blue", -5)).toContain(" 0%,");
  });
});

describe("widgetQuery and seriesUnit", () => {
  it("turns a widget into a metrics query", () => {
    expect(widgetQuery(widget())).toEqual({
      metrics: [{ variable: "tasks.completed" }],
      grouping: "day",
      period: { kind: "last", days: 30 },
      habitFilter: { kind: "all" },
    });
  });

  it("measures ratios in percent", () => {
    expect(seriesUnit(count())).toBe("count");
    expect(seriesUnit(rate())).toBe("percent");
    expect(
      seriesUnit({
        ...count(),
        metric: { variable: "tasks.completedOnTime", divideBy: "tasks.completed" },
      }),
    ).toBe("percent");
  });
});

describe("widgetErrors", () => {
  it("accepts every widget of the default dashboard", () => {
    for (const section of DEFAULT_DASHBOARD.sections) {
      for (const item of section.widgets) {
        expect(widgetErrors(item), item.id).toEqual([]);
      }
    }
  });

  it("checks the title, labels, number of series and colors", () => {
    expect(widgetErrors(widget({ title: "  " }))).toEqual([
      "O título precisa ter de 1 a 60 caracteres.",
    ]);
    expect(
      widgetErrors(widget({ series: Array.from({ length: 7 }, (_, i) => count(`S${i}`)) })),
    ).toEqual(["Use no máximo 6 métricas."]);
    expect(widgetErrors(widget({ series: [count(" ")] }))).toEqual([
      "Cada métrica precisa de um nome de 1 a 40 caracteres.",
    ]);
    expect(widgetErrors(widget({ series: [{ ...count(), color: "#12" as "blue" }] }))).toEqual([
      "Cor inválida.",
    ]);
    expect(widgetErrors(widget({ background: "nope" as "blue" }))).toEqual(["Cor inválida."]);
  });

  it("rejects unknown chart types and passes on query errors", () => {
    expect(widgetErrors(widget({ chart: "pie" as "bar" }))).toEqual([
      "Tipo de gráfico desconhecido.",
    ]);
    expect(widgetErrors(widget({ grouping: "habit" }))).toEqual([
      "Agrupar por hábito só funciona com métricas de hábitos.",
    ]);
  });

  it("keeps the widget inside the grid", () => {
    expect(widgetErrors(widget({ layout: { x: 3, y: 0, w: 2, h: 1 } }))).toEqual([
      "Posição ou tamanho inválido.",
    ]);
    expect(widgetErrors(widget({ layout: { x: 0, y: -1, w: 1, h: 1 } }))).toHaveLength(1);
    expect(widgetErrors(widget({ layout: { x: 0, y: 50, w: 1, h: 1 } }))).toEqual([]);
    expect(widgetErrors(widget({ layout: { x: 0, y: 51, w: 1, h: 1 } }))).toHaveLength(1);
    expect(widgetErrors(widget({ layout: { x: 0, y: 0, w: 1, h: 5 } }))).toHaveLength(1);
    expect(widgetErrors(widget({ layout: { x: 0.5, y: 0, w: 1, h: 1 } }))).toHaveLength(1);
    expect(
      widgetErrors(widget({ grouping: "month" as "day", layout: { x: 9, y: 0, w: 1, h: 1 } })),
    ).toEqual(["Agrupamento desconhecido.", "Posição ou tamanho inválido."]);
  });

  it("shows one ungrouped metric as a number", () => {
    expect(widgetErrors(widget({ chart: "number", grouping: "none" }))).toEqual([]);
    expect(widgetErrors(widget({ chart: "number" }))).toEqual([
      "O número mostra uma métrica, sem agrupamento.",
    ]);
  });

  it("draws one metric per day as a heatmap", () => {
    expect(widgetErrors(widget({ chart: "heatmap" }))).toEqual([]);
    expect(widgetErrors(widget({ chart: "heatmap", grouping: "week" }))).toEqual([
      "O mapa mostra uma métrica agrupada por dia.",
    ]);
  });

  it("draws donuts from several counts, or one count by weekday or habit", () => {
    expect(
      widgetErrors(widget({ chart: "donut", grouping: "none", series: [count("A"), count("B")] })),
    ).toEqual([]);
    expect(widgetErrors(widget({ chart: "donut", grouping: "weekday" }))).toEqual([]);
    expect(widgetErrors(widget({ chart: "donut", grouping: "day" }))).toEqual([
      "A rosca precisa de várias métricas no total, ou uma por dia da semana ou por hábito.",
    ]);
    expect(widgetErrors(widget({ chart: "donut", grouping: "habit", series: [rate()] }))).toEqual([
      "A rosca só mostra contagens.",
    ]);
  });

  it("keeps one unit per cartesian chart and stacks only counts", () => {
    expect(widgetErrors(widget({ series: [count(), rate()], grouping: "day" }))).toEqual([
      "As séries de um gráfico precisam da mesma unidade.",
    ]);
    expect(widgetErrors(widget({ chart: "area", stacked: true, series: [rate()] }))).toEqual([
      "Só contagens podem ser empilhadas.",
    ]);
    expect(widgetErrors(widget({ chart: "line", stacked: true }))).toEqual([]);
  });

  it("lists anything, units mixed", () => {
    expect(
      widgetErrors(
        widget({
          chart: "list",
          grouping: "habit",
          series: [rate(), { ...rate("Seq"), metric: { variable: "habits.currentStreak" } }],
        }),
      ),
    ).toEqual([]);
  });
});
