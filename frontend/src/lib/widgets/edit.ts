/**
 * Changes the builder makes to a dashboard (D26, D30), as pure functions that return a new configuration.
 * They do not validate; the caller checks the result with `dashboardErrors()` before saving.
 */
import type { ChartType, DashboardConfig, DashboardSection, WidgetConfig } from "./config";
import { compactSection, placeAtEnd } from "./layout";

/** A short id that is not taken yet (lower-case, digits and dashes, as the API requires). */
export function newId(prefix: string, taken: ReadonlySet<string>, random = randomPart): string {
  for (;;) {
    const id = `${prefix}-${random()}`;
    if (!taken.has(id)) return id;
  }
}

/** Eight hex digits. `getRandomValues` also works off localhost over plain HTTP, unlike `randomUUID`. */
function randomPart(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function widgetIds(config: DashboardConfig): Set<string> {
  return new Set(config.sections.flatMap((section) => section.widgets.map((widget) => widget.id)));
}

export function findWidget(
  config: DashboardConfig,
  id: string,
): { section: DashboardSection; widget: WidgetConfig } | undefined {
  for (const section of config.sections) {
    const widget = section.widgets.find((candidate) => candidate.id === id);
    if (widget) return { section, widget };
  }
  return undefined;
}

export function replaceSection(
  config: DashboardConfig,
  section: DashboardSection,
): DashboardConfig {
  return {
    ...config,
    sections: config.sections.map((current) => (current.id === section.id ? section : current)),
  };
}

/**
 * Stores an edited or new widget in `sectionId`. A widget that stays in its section keeps its place (a new
 * size pushes the others down); one that is new or changes section goes to the end of its new section.
 */
export function saveWidget(
  config: DashboardConfig,
  sectionId: string,
  widget: WidgetConfig,
): DashboardConfig {
  const current = findWidget(config, widget.id);
  const staysPut = current?.section.id === sectionId;

  const sections = config.sections.map((section) => {
    if (section.id === sectionId) {
      if (staysPut) {
        return compactSection({
          ...section,
          widgets: section.widgets.map((other) => (other.id === widget.id ? widget : other)),
        });
      }
      const placed = { ...widget, layout: placeAtEnd(section, widget.layout.w, widget.layout.h) };
      return compactSection({ ...section, widgets: [...section.widgets, placed] });
    }
    if (section.id === current?.section.id) {
      return compactSection({
        ...section,
        widgets: section.widgets.filter((other) => other.id !== widget.id),
      });
    }
    return section;
  });
  return { ...config, sections };
}

export function deleteWidget(config: DashboardConfig, id: string): DashboardConfig {
  const found = findWidget(config, id);
  if (!found) return config;
  return replaceSection(
    config,
    compactSection({
      ...found.section,
      widgets: found.section.widgets.filter((widget) => widget.id !== id),
    }),
  );
}

export function addSection(config: DashboardConfig, title: string, id: string): DashboardConfig {
  return { ...config, sections: [...config.sections, { id, title: title.trim(), widgets: [] }] };
}

export function renameSection(config: DashboardConfig, id: string, title: string): DashboardConfig {
  return {
    ...config,
    sections: config.sections.map((section) =>
      section.id === id ? { ...section, title: title.trim() } : section,
    ),
  };
}

/** Only an empty section can be deleted (D30); otherwise the configuration comes back unchanged. */
export function deleteSection(config: DashboardConfig, id: string): DashboardConfig {
  const section = config.sections.find((candidate) => candidate.id === id);
  if (!section || section.widgets.length > 0) return config;
  return { ...config, sections: config.sections.filter((candidate) => candidate.id !== id) };
}

/** What "Adicionar gráfico" starts from: completed tasks per day, last 30 days. */
export function newWidget(id: string): WidgetConfig {
  return {
    id,
    title: "Novo gráfico",
    chart: "bar",
    series: [
      { metric: { variable: "tasks.completed" }, label: "Tarefas concluídas", color: "blue" },
    ],
    grouping: "day",
    period: { kind: "last", days: 30 },
    habitFilter: { kind: "all" },
    layout: { x: 0, y: 0, w: 2, h: 1 },
  };
}

/**
 * Switches the chart type and nudges the rest towards something that chart can draw: a number shows one
 * metric in total, a heatmap one metric by day, a donut needs a total or a weekday/habit split.
 */
export function withChart(widget: WidgetConfig, chart: ChartType): WidgetConfig {
  switch (chart) {
    case "number":
      return { ...widget, chart, series: widget.series.slice(0, 1), grouping: "none" };
    case "heatmap":
      return { ...widget, chart, series: widget.series.slice(0, 1), grouping: "day" };
    case "donut": {
      const keeps = ["none", "weekday", "habit"].includes(widget.grouping);
      return { ...widget, chart, grouping: keeps ? widget.grouping : "none" };
    }
    default:
      return { ...widget, chart };
  }
}

/** A copy of `value` without the optional field `key` (the API and the parser treat absent and unset alike). */
export function withoutField<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)) as Omit<T, K>;
}
