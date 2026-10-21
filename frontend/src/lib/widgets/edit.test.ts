import { describe, expect, it } from "vitest";
import { dashboardErrors, type DashboardConfig, type WidgetConfig } from "./config";
import { DEFAULT_DASHBOARD } from "./default-dashboard";
import {
  addSection,
  deleteSection,
  deleteWidget,
  findWidget,
  newId,
  newWidget,
  renameSection,
  replaceSection,
  saveWidget,
  widgetIds,
  withChart,
  withoutField,
} from "./edit";

const config = DEFAULT_DASHBOARD;
const onTime = findWidget(config, "tasks-on-time")!.widget;

function sectionOf(result: DashboardConfig, id: string) {
  return findWidget(result, id)?.section.id;
}

describe("ids", () => {
  it("makes ids the API accepts and skips taken ones", () => {
    const values = ["aaaa", "bbbb"];
    const id = newId("w", new Set(["w-aaaa"]), () => values.shift()!);
    expect(id).toBe("w-bbbb");
    expect(newId("s", new Set())).toMatch(/^s-[a-z0-9-]{8}$/);
  });

  it("lists every widget id", () => {
    expect(widgetIds(config)).toContain("trends-weekday");
    expect(widgetIds(config).size).toBe(8);
  });
});

describe("findWidget / replaceSection", () => {
  it("finds a widget with its section, or nothing", () => {
    expect(findWidget(config, "habits-per-habit")?.section.id).toBe("habits");
    expect(findWidget(config, "nope")).toBeUndefined();
  });

  it("replaces one section and keeps the others", () => {
    const section = { ...config.sections[1], title: "Rotina" };
    const result = replaceSection(config, section);
    expect(result.sections[1].title).toBe("Rotina");
    expect(result.sections[0]).toBe(config.sections[0]);
    expect(config.sections[1].title).toBe("Hábitos");
  });
});

describe("saveWidget", () => {
  it("edits a widget in place", () => {
    const result = saveWidget(config, "tasks", { ...onTime, title: "Pontualidade" });
    expect(findWidget(result, "tasks-on-time")?.widget).toMatchObject({
      title: "Pontualidade",
      layout: onTime.layout,
    });
    expect(dashboardErrors(result)).toEqual([]);
  });

  it("pushes neighbours down when a widget grows", () => {
    const grown: WidgetConfig = { ...onTime, layout: { ...onTime.layout, h: 2 } };
    const result = saveWidget(config, "tasks", grown);
    expect(findWidget(result, "tasks-next-7-days")?.widget.layout.y).toBe(2);
    expect(dashboardErrors(result)).toEqual([]);
  });

  it("moves a widget to the end of another section", () => {
    const result = saveWidget(config, "trends", onTime);
    expect(sectionOf(result, "tasks-on-time")).toBe("trends");
    expect(findWidget(result, "tasks-on-time")?.widget.layout).toEqual({ x: 0, y: 1, w: 1, h: 1 });
    expect(result.sections[0].widgets.map(({ id }) => id)).not.toContain("tasks-on-time");
    expect(dashboardErrors(result)).toEqual([]);
  });

  it("adds a new widget at the end of its section", () => {
    const widget = newWidget("w-new");
    const result = saveWidget(config, "habits", widget);
    expect(findWidget(result, "w-new")?.widget.layout).toEqual({ x: 0, y: 2, w: 2, h: 1 });
    expect(dashboardErrors(result)).toEqual([]);
  });

  it("does not touch the original", () => {
    saveWidget(config, "trends", onTime);
    expect(sectionOf(config, "tasks-on-time")).toBe("tasks");
  });
});

describe("deleteWidget", () => {
  it("removes the widget and closes the gap", () => {
    const result = deleteWidget(config, "tasks-per-day");
    expect(findWidget(result, "tasks-per-day")).toBeUndefined();
    expect(findWidget(result, "tasks-on-time")?.widget.layout).toMatchObject({ y: 0 });
  });

  it("ignores unknown widgets", () => {
    expect(deleteWidget(config, "nope")).toBe(config);
  });
});

describe("sections", () => {
  it("adds a trimmed, empty section at the end", () => {
    const result = addSection(config, "  Metas ", "s-1");
    expect(result.sections.at(-1)).toEqual({ id: "s-1", title: "Metas", widgets: [] });
  });

  it("renames a section", () => {
    expect(renameSection(config, "trends", " Longo prazo ").sections[2].title).toBe("Longo prazo");
    expect(renameSection(config, "nope", "X")).toEqual(config);
  });

  it("deletes only empty sections", () => {
    const withEmpty = addSection(config, "Vazia", "s-1");
    expect(deleteSection(withEmpty, "s-1").sections).toHaveLength(3);
    expect(deleteSection(config, "tasks")).toBe(config);
    expect(deleteSection(config, "nope")).toBe(config);
  });
});

describe("newWidget / withChart", () => {
  it("starts from a valid widget", () => {
    const result = saveWidget(config, "tasks", newWidget("w-1"));
    expect(dashboardErrors(result)).toEqual([]);
  });

  const two: WidgetConfig = {
    ...newWidget("w"),
    series: [
      { metric: { variable: "tasks.completed" }, label: "A", color: "blue" },
      { metric: { variable: "tasks.created" }, label: "B", color: "orange" },
    ],
  };

  it("keeps one ungrouped metric for a number", () => {
    expect(withChart(two, "number")).toMatchObject({ chart: "number", grouping: "none" });
    expect(withChart(two, "number").series).toHaveLength(1);
  });

  it("keeps one metric by day for a heatmap", () => {
    const result = withChart({ ...two, grouping: "week" }, "heatmap");
    expect(result).toMatchObject({ chart: "heatmap", grouping: "day" });
    expect(result.series).toHaveLength(1);
  });

  it("sends a donut to a total unless it is split by weekday or habit", () => {
    expect(withChart(two, "donut").grouping).toBe("none");
    expect(withChart({ ...two, grouping: "weekday" }, "donut").grouping).toBe("weekday");
  });

  it("only switches the type for the other charts", () => {
    expect(withChart(two, "line")).toEqual({ ...two, chart: "line" });
  });
});

describe("withoutField", () => {
  it("drops one field and leaves the original alone", () => {
    const widget = { ...newWidget("w"), stacked: true };
    const result = withoutField(widget, "stacked");
    expect("stacked" in result).toBe(false);
    expect(widget.stacked).toBe(true);
  });
});
