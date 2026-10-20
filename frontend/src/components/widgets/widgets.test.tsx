import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Bucket, MetricResult } from "@/lib/metrics/types";
import type { WidgetConfig } from "@/lib/widgets/config";
import type { WidgetState } from "@/lib/widgets/data";
import { ChartTooltipCard } from "./chart-tooltip";
import { slicesOf } from "./donut-chart";
import { levelOf } from "./heatmap-chart";
import { rankedRows } from "./list-widget";
import { WidgetCard } from "./widget-card";

function widget(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    id: "w",
    title: "Concluídas por dia",
    chart: "bar",
    series: [{ metric: { variable: "tasks.completed" }, label: "Concluídas", color: "blue" }],
    grouping: "day",
    period: { kind: "last", days: 7 },
    habitFilter: { kind: "all" },
    layout: { x: 1, y: 0, w: 2, h: 2 },
    ...overrides,
  };
}

const days: Bucket[] = [
  { key: "2026-10-16", label: "16/10", range: { from: "2026-10-16", to: "2026-10-16" } },
  { key: "2026-10-17", label: "17/10", range: { from: "2026-10-17", to: "2026-10-17" } },
];

function result(series: MetricResult["series"], buckets: Bucket[] = days): MetricResult {
  return { range: { from: "2026-10-16", to: "2026-10-17" }, buckets, series };
}

function ready(value: MetricResult): WidgetState {
  return { status: "ready", result: value };
}

function card(config: WidgetConfig, state: WidgetState) {
  render(<WidgetCard widget={config} state={state} />);
  return screen.getByRole("region", { name: config.title });
}

describe("WidgetCard", () => {
  it("names the period and places itself in the grid", () => {
    const region = card(widget(), { status: "loading" });

    expect(region).toHaveTextContent("Últimos 7 dias");
    expect(region.style.getPropertyValue("--x")).toBe("2");
    expect(region.style.getPropertyValue("--w")).toBe("2");
    expect(region.style.getPropertyValue("--w-sm")).toBe("2");
    expect(region.style.getPropertyValue("--chart-h-lg")).toBe("410px");
  });

  it("tints the card with its background color", () => {
    const region = card(widget({ background: "violet" }), { status: "loading" });
    expect(region.style.backgroundColor).toContain("var(--viz-violet)");
  });

  it("shows a skeleton while loading", () => {
    card(widget(), { status: "loading" });
    expect(
      screen.getByRole("status", { name: "Carregando Concluídas por dia" }),
    ).toBeInTheDocument();
  });

  it("shows an error with a retry", async () => {
    const retry = vi.fn();
    const region = card(widget(), { status: "error", what: "as tarefas", retry });

    expect(within(region).getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as tarefas",
    );
    await userEvent.click(within(region).getByRole("button", { name: "Tentar novamente" }));
    expect(retry).toHaveBeenCalled();
  });

  it("explains why an invalid widget is not drawn", () => {
    const region = card(widget(), { status: "invalid", errors: ["Cor inválida."] });
    expect(within(region).getByRole("alert")).toHaveTextContent(
      "Este gráfico não pode ser exibido: Cor inválida.",
    );
  });

  it("invites to the tasks or habits page when there is nothing to show", () => {
    const tasks = card(widget(), ready(result([{ unit: "count", values: [0, 0] }])));
    expect(tasks).toHaveTextContent("Nada para mostrar neste período ainda.");
    expect(within(tasks).getByRole("link", { name: "Ver tarefas" })).toHaveAttribute(
      "href",
      "/tasks",
    );
  });

  it("sends habit widgets with nothing to show to the habits page", () => {
    const habits = card(
      widget({
        title: "Hábitos",
        series: [
          {
            metric: { variable: "tasks.completed", divideBy: "habits.completed" },
            label: "Razão",
            color: "blue",
          },
        ],
      }),
      ready(result([{ unit: "percent", values: [null, null] }])),
    );
    expect(within(habits).getByRole("link", { name: "Ver hábitos" })).toHaveAttribute(
      "href",
      "/habits",
    );
  });

  it("draws bar charts as an image with a summary, a legend and the numbers table", () => {
    const config = widget({
      series: [
        { metric: { variable: "tasks.completed" }, label: "Concluídas", color: "blue" },
        { metric: { variable: "tasks.created" }, label: "Criadas", color: "orange", mark: "line" },
      ],
    });
    const region = card(
      config,
      ready(
        result([
          { unit: "count", values: [1, 2] },
          { unit: "count", values: [3, 0] },
        ]),
      ),
    );

    expect(within(region).getByRole("img")).toHaveAccessibleName(
      "Concluídas por dia: Concluídas: 3 no total. Criadas: 3 no total.",
    );
    expect(region).toHaveTextContent("ConcluídasCriadas");
    const table = within(region).getByRole("table", { hidden: true });
    expect(
      within(table)
        .getAllByRole("row", { hidden: true })
        .map((row) => row.textContent),
    ).toEqual(["PeríodoConcluídasCriadas", "16/1013", "17/1020"]);
  });

  it("draws line and area charts too", () => {
    for (const chart of ["line", "area"] as const) {
      const config = widget({ chart, title: `Gráfico ${chart}`, stacked: chart === "area" });
      const region = card(config, ready(result([{ unit: "count", values: [1, 2] }])));
      expect(within(region).getByRole("img")).toBeInTheDocument();
    }
  });

  it("shows a number with the counts behind a ratio", () => {
    const region = card(
      widget({ chart: "number", title: "No prazo", grouping: "none" }),
      ready(
        result(
          [{ unit: "percent", values: [75], parts: { numerator: [3], denominator: [4] } }],
          [{ key: "total", label: "Total" }],
        ),
      ),
    );
    expect(region).toHaveTextContent("75%");
    expect(region).toHaveTextContent("Concluídas: 3 de 4");
  });

  it("shows a dash in a number widget with nothing to count", () => {
    const region = card(
      widget({ chart: "number", title: "No prazo", grouping: "none" }),
      ready(
        result(
          [{ unit: "percent", values: [null], parts: { numerator: [0], denominator: [0] } }],
          [{ key: "total", label: "Total" }],
        ),
      ),
    );
    expect(region).toHaveTextContent("—");
    expect(region).not.toHaveTextContent("0 de 0");
  });

  it("draws a donut whose summary and legend name every slice", () => {
    const region = card(
      widget({
        chart: "donut",
        title: "Situação",
        grouping: "none",
        series: [
          { metric: { variable: "tasks.openOverdue" }, label: "Atrasadas", color: "orange" },
          { metric: { variable: "tasks.openWithoutDueDate" }, label: "Sem prazo", color: "aqua" },
        ],
      }),
      ready(
        result(
          [
            { unit: "count", values: [2] },
            { unit: "count", values: [0] },
          ],
          [{ key: "total", label: "Total" }],
        ),
      ),
    );
    expect(within(region).getByRole("img")).toHaveAccessibleName(
      "Situação: Atrasadas: 2 no total. Sem prazo: 0 no total.",
    );
    expect(region).toHaveTextContent("2no total");
    expect(within(region).getByRole("table", { hidden: true })).toHaveTextContent(
      "AtrasadasSem prazoTotal20",
    );
    expect(region).toHaveTextContent("Atrasadas2Sem prazo0");
  });

  it("draws a heatmap with one square per day after the blank days of the first week", () => {
    const region = card(
      widget({ chart: "heatmap", title: "Mapa" }),
      ready(result([{ unit: "percent", values: [null, 80] }])),
    );
    expect(within(region).getByTitle("16/10: —")).toHaveAttribute("data-level", "none");
    expect(within(region).getByTitle("17/10: 80%")).toHaveAttribute("data-level", "4");
    expect(within(region).getByRole("img")).toHaveAccessibleName(
      "Mapa: Concluídas: maior valor 80% (17/10).",
    );
  });

  it("scales heatmap counts by the busiest day", () => {
    const region = card(
      widget({ chart: "heatmap", title: "Mapa" }),
      ready(result([{ unit: "count", values: [1, 4] }])),
    );
    expect(within(region).getByTitle("16/10: 1")).toHaveAttribute("data-level", "1");
    expect(within(region).getByTitle("17/10: 4")).toHaveAttribute("data-level", "4");
  });

  it("lists rows best first with the other series below", () => {
    const region = card(
      widget({
        chart: "list",
        title: "Por hábito",
        grouping: "habit",
        series: [
          { metric: { variable: "habits.completionRate" }, label: "Conclusão", color: "done" },
          { metric: { variable: "habits.currentStreak" }, label: "Sequência atual", color: "blue" },
        ],
      }),
      ready(
        result(
          [
            { unit: "percent", values: [null, 50, 90] },
            { unit: "streak", values: [0, 1, 4] },
          ],
          [
            { key: "habit:1", label: "Ler" },
            { key: "habit:2", label: "Correr" },
            { key: "habit:3", label: "Meditar" },
          ],
        ),
      ),
    );
    const list = within(region).getByRole("list", { name: "Por hábito" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((row) => row.textContent),
    ).toEqual([
      "MeditarConclusão: 90%Sequência atual: 4 seguidas",
      "CorrerConclusão: 50%Sequência atual: 1 seguida",
      "LerConclusão: —Sequência atual: 0 seguidas",
    ]);
  });

  it("lists rows with nothing measured yet, and is empty only without rows", () => {
    const config = widget({ chart: "list", title: "Lista", grouping: "habit" });
    const withRow = card(
      config,
      ready(result([{ unit: "percent", values: [null] }], [{ key: "habit:1", label: "Ler" }])),
    );
    expect(withRow).toHaveTextContent("LerConcluídas: —");
    cleanup();

    const empty = card(config, ready(result([{ unit: "percent", values: [] }], [])));
    expect(empty).toHaveTextContent("Nada para mostrar neste período ainda.");
  });

  it("lists counts without bars", () => {
    const region = card(
      widget({ chart: "list", title: "Lista" }),
      ready(result([{ unit: "count", values: [2, 5] }])),
    );
    expect(
      within(region)
        .getAllByRole("listitem")
        .map((row) => row.textContent),
    ).toEqual(["17/10Concluídas: 5", "16/10Concluídas: 2"]);
  });
});

describe("renderer helpers", () => {
  it("levels heatmap values in four steps", () => {
    expect(levelOf(null, 100)).toBeNull();
    expect(levelOf(0, 100)).toBe(0);
    expect(levelOf(5, 0)).toBe(0);
    expect(levelOf(25, 100)).toBe(1);
    expect(levelOf(26, 100)).toBe(2);
    expect(levelOf(75, 100)).toBe(3);
    expect(levelOf(100, 100)).toBe(4);
  });

  it("ranks list rows, empty ones last and ties in order", () => {
    expect(
      rankedRows(
        result(
          [{ unit: "percent", values: [null, 10, 10, null, 50] }],
          [...Array.from({ length: 5 }, (_, i) => ({ key: String(i), label: String(i) }))],
        ),
      ),
    ).toEqual([4, 1, 2, 0, 3]);
  });

  it("makes donut slices from buckets with palette colors in order, from the series color", () => {
    const config = widget({
      chart: "donut",
      grouping: "weekday",
      series: [{ metric: { variable: "tasks.completed" }, label: "A", color: "aqua" }],
    });
    const slices = slicesOf(
      config,
      result(
        [{ unit: "count", values: [3, null] }],
        [
          { key: "0", label: "Dom" },
          { key: "1", label: "Seg" },
        ],
      ),
    );
    expect(slices).toEqual([
      { label: "Dom", value: 3, color: "aqua" },
      { label: "Seg", value: 0, color: "yellow" },
    ]);
  });

  it("starts donut slices at the first hue for a custom series color", () => {
    const config = widget({
      chart: "donut",
      grouping: "weekday",
      series: [{ metric: { variable: "tasks.completed" }, label: "A", color: "#123456" }],
    });
    expect(
      slicesOf(config, result([{ unit: "count", values: [1] }], [{ key: "0", label: "Dom" }]))[0]
        .color,
    ).toBe("blue");
  });

  it("writes the tooltip rows with their values", () => {
    render(
      <ChartTooltipCard
        title="17/10"
        rows={[
          { label: "Feitos", color: "done", value: 2, unit: "count" },
          { label: "Taxa", color: "blue", value: null, unit: "percent" },
        ]}
      />,
    );
    expect(screen.getByText("17/10").parentElement).toHaveTextContent("17/10Feitos2Taxa—");
  });
});
