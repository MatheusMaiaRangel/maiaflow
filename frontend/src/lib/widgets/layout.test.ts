import { describe, expect, it } from "vitest";
import type { DashboardSection, WidgetConfig, WidgetLayout } from "./config";
import { DEFAULT_DASHBOARD } from "./default-dashboard";
import {
  compactSection,
  gridItems,
  moveWidget,
  packInOrder,
  placeAtEnd,
  readingOrder,
  reorderWidget,
  resizeWidget,
  withGridItems,
} from "./layout";

const base: WidgetConfig = DEFAULT_DASHBOARD.sections[0].widgets[0];

function widget(id: string, layout: WidgetLayout): WidgetConfig {
  return { ...base, id, title: id, layout };
}

function section(...widgets: WidgetConfig[]): DashboardSection {
  return { id: "s", title: "Seção", widgets };
}

function places(result: DashboardSection): Record<string, WidgetLayout> {
  return Object.fromEntries(result.widgets.map(({ id, layout }) => [id, layout]));
}

function ids(result: DashboardSection): string[] {
  return readingOrder(result).map(({ id }) => id);
}

const tasks = DEFAULT_DASHBOARD.sections[0];

describe("gridItems / withGridItems", () => {
  it("turns widgets into grid items with the size limits", () => {
    expect(gridItems(section(widget("a", { x: 1, y: 2, w: 2, h: 3 })))).toEqual([
      { i: "a", x: 1, y: 2, w: 2, h: 3, minW: 1, maxW: 4, minH: 1, maxH: 4 },
    ]);
  });

  it("clips items to fewer columns", () => {
    const [item] = gridItems(section(widget("a", { x: 3, y: 0, w: 4, h: 1 })), 1);
    expect(item).toMatchObject({ x: 0, w: 1 });
  });

  it("keeps the same objects when nothing moved", () => {
    const original = section(widget("a", { x: 0, y: 0, w: 1, h: 1 }));
    expect(withGridItems(original, gridItems(original))).toBe(original);
  });

  it("ignores items of unknown widgets and leaves widgets without an item alone", () => {
    const original = section(widget("a", { x: 0, y: 0, w: 1, h: 1 }));
    const result = withGridItems(original, [{ i: "zzz", x: 1, y: 1, w: 1, h: 1 }]);
    expect(result).toBe(original);
  });

  it("returns a new section with the new places", () => {
    const original = section(
      widget("a", { x: 0, y: 0, w: 1, h: 1 }),
      widget("b", { x: 1, y: 0, w: 1, h: 1 }),
    );
    const result = withGridItems(original, [{ i: "a", x: 2, y: 0, w: 1, h: 1 }]);
    expect(result).not.toBe(original);
    expect(result.widgets[1]).toBe(original.widgets[1]);
    expect(places(result).a).toEqual({ x: 2, y: 0, w: 1, h: 1 });
    expect(places(original).a).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});

describe("compactSection", () => {
  it("floats widgets up into holes", () => {
    const result = compactSection(section(widget("a", { x: 0, y: 3, w: 2, h: 1 })));
    expect(places(result).a).toEqual({ x: 0, y: 0, w: 2, h: 1 });
  });

  it("pushes overlapping widgets down", () => {
    const result = compactSection(
      section(widget("a", { x: 0, y: 0, w: 2, h: 2 }), widget("b", { x: 1, y: 1, w: 2, h: 1 })),
    );
    expect(places(result).b).toEqual({ x: 1, y: 2, w: 2, h: 1 });
  });

  it("leaves the default sections as they are", () => {
    for (const original of DEFAULT_DASHBOARD.sections)
      expect(compactSection(original)).toBe(original);
  });
});

describe("moveWidget", () => {
  it("moves right and stops at the last column", () => {
    const original = section(widget("a", { x: 0, y: 0, w: 2, h: 1 }));
    expect(places(moveWidget(original, "a", 1, 0)).a.x).toBe(1);
    expect(places(moveWidget(original, "a", 5, 0)).a.x).toBe(2);
    expect(places(moveWidget(original, "a", -1, 0)).a.x).toBe(0);
  });

  it("swaps with the widget below when moving down", () => {
    const original = section(
      widget("a", { x: 0, y: 0, w: 4, h: 1 }),
      widget("b", { x: 0, y: 1, w: 4, h: 1 }),
    );
    expect(ids(moveWidget(original, "a", 0, 1))).toEqual(["b", "a"]);
  });

  it("swaps with the widget above when moving up", () => {
    const original = section(
      widget("a", { x: 0, y: 0, w: 4, h: 1 }),
      widget("b", { x: 0, y: 1, w: 4, h: 1 }),
    );
    expect(ids(moveWidget(original, "b", 0, -1))).toEqual(["b", "a"]);
  });

  it("pushes a neighbour out of the way when moving sideways into it", () => {
    const result = moveWidget(
      section(widget("a", { x: 0, y: 0, w: 2, h: 1 }), widget("b", { x: 2, y: 0, w: 2, h: 1 })),
      "a",
      2,
      0,
    );
    expect(places(result).a).toMatchObject({ x: 2 });
    expect(Object.values(places(result))).toHaveLength(2);
  });

  it("does not leave the top or a hole", () => {
    const original = section(widget("a", { x: 0, y: 0, w: 1, h: 1 }));
    expect(moveWidget(original, "a", 0, -1)).toBe(original);
    expect(moveWidget(original, "a", 0, 1)).toBe(original);
  });

  it("ignores unknown widgets", () => {
    expect(moveWidget(tasks, "nope", 1, 0)).toBe(tasks);
  });
});

describe("resizeWidget", () => {
  it("grows and shrinks within the limits", () => {
    const original = section(widget("a", { x: 1, y: 0, w: 2, h: 2 }));
    expect(places(resizeWidget(original, "a", 1, 1)).a).toEqual({ x: 1, y: 0, w: 3, h: 3 });
    expect(places(resizeWidget(original, "a", 5, 5)).a).toEqual({ x: 1, y: 0, w: 3, h: 4 });
    expect(places(resizeWidget(original, "a", -5, -5)).a).toEqual({ x: 1, y: 0, w: 1, h: 1 });
  });

  it("pushes the widgets it grows into down", () => {
    const result = resizeWidget(
      section(widget("a", { x: 0, y: 0, w: 2, h: 1 }), widget("b", { x: 2, y: 0, w: 2, h: 1 })),
      "a",
      1,
      0,
    );
    expect(places(result)).toEqual({
      a: { x: 0, y: 0, w: 3, h: 1 },
      b: { x: 2, y: 1, w: 2, h: 1 },
    });
  });
});

describe("packInOrder / reorderWidget", () => {
  it("lays widgets out in the given order", () => {
    const original = section(
      widget("a", { x: 0, y: 0, w: 2, h: 1 }),
      widget("b", { x: 2, y: 0, w: 2, h: 1 }),
      widget("c", { x: 0, y: 1, w: 4, h: 1 }),
    );
    expect(ids(packInOrder(original, ["c", "b", "a"]))).toEqual(["c", "b", "a"]);
    expect(places(packInOrder(original, ["c", "b", "a"]))).toEqual({
      c: { x: 0, y: 0, w: 4, h: 1 },
      b: { x: 0, y: 1, w: 2, h: 1 },
      a: { x: 2, y: 1, w: 2, h: 1 },
    });
  });

  it("keeps widgets missing from the order", () => {
    const original = section(
      widget("a", { x: 0, y: 0, w: 2, h: 1 }),
      widget("b", { x: 2, y: 0, w: 2, h: 1 }),
    );
    expect(
      packInOrder(original, ["b"])
        .widgets.map(({ id }) => id)
        .sort(),
    ).toEqual(["a", "b"]);
  });

  it("moves a widget one place down and up in the reading order", () => {
    expect(ids(tasks)).toEqual([
      "tasks-per-day",
      "tasks-on-time",
      "tasks-status",
      "tasks-next-7-days",
    ]);
    expect(ids(reorderWidget(tasks, "tasks-per-day", 1))).toEqual([
      "tasks-on-time",
      "tasks-per-day",
      "tasks-status",
      "tasks-next-7-days",
    ]);
    expect(ids(reorderWidget(tasks, "tasks-next-7-days", -1))).toEqual([
      "tasks-per-day",
      "tasks-on-time",
      "tasks-next-7-days",
      "tasks-status",
    ]);
  });

  it("keeps sizes and never overlaps", () => {
    const result = reorderWidget(tasks, "tasks-status", -2);
    for (const original of tasks.widgets) {
      const moved = result.widgets.find(({ id }) => id === original.id);
      expect(moved?.layout).toMatchObject({ w: original.layout.w, h: original.layout.h });
    }
    expect(ids(result)[0]).toBe("tasks-status");
  });

  it("does nothing at the ends or for unknown widgets", () => {
    expect(reorderWidget(tasks, "tasks-per-day", -1)).toBe(tasks);
    expect(reorderWidget(tasks, "nope", 1)).toBe(tasks);
  });
});

describe("placeAtEnd", () => {
  it("puts a new widget below the others", () => {
    expect(placeAtEnd(tasks, 2, 1)).toEqual({ x: 0, y: 2, w: 2, h: 1 });
    expect(placeAtEnd(section(), 9, 9)).toEqual({ x: 0, y: 0, w: 4, h: 4 });
  });
});
