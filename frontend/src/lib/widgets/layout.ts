/**
 * Layout changes inside a section (D29, D30), as pure functions. They use react-grid-layout's own collision
 * and compaction code, so a keyboard move ends where the same drag would. Widgets always float up (vertical
 * compaction), so a stored section has no holes and no overlaps.
 */
import {
  cloneLayout,
  moveElement,
  verticalCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout/core";
import {
  GRID_COLUMNS,
  MAX_ROWS_PER_WIDGET,
  type DashboardSection,
  type WidgetConfig,
  type WidgetLayout,
} from "./config";

/** Reading order on narrow screens: row by row, left to right. */
export function byPosition(a: WidgetConfig, b: WidgetConfig): number {
  return a.layout.y - b.layout.y || a.layout.x - b.layout.x;
}

export function readingOrder(section: DashboardSection): WidgetConfig[] {
  return section.widgets.toSorted(byPosition);
}

/** The section's widgets as react-grid-layout items (`i` is the widget id). */
export function gridItems(section: DashboardSection, columns = GRID_COLUMNS): LayoutItem[] {
  return section.widgets.map(({ id, layout }) => ({
    i: id,
    x: Math.min(layout.x, columns - 1),
    y: layout.y,
    w: Math.min(layout.w, columns),
    h: layout.h,
    minW: 1,
    maxW: columns,
    minH: 1,
    maxH: MAX_ROWS_PER_WIDGET,
  }));
}

function sameLayout(a: WidgetLayout, b: WidgetLayout): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/** The section with the places from `items`; widgets that did not move keep their objects. */
export function withGridItems(section: DashboardSection, items: Layout): DashboardSection {
  const places = new Map(items.map(({ i, x, y, w, h }) => [i, { x, y, w, h }]));
  let changed = false;
  const widgets = section.widgets.map((widget) => {
    const place = places.get(widget.id);
    if (!place || sameLayout(place, widget.layout)) return widget;
    changed = true;
    return { ...widget, layout: place };
  });
  return changed ? { ...section, widgets } : section;
}

function compact(items: Layout): Layout {
  return verticalCompactor.compact(items, GRID_COLUMNS);
}

/** Floats every widget up, closing holes and resolving overlaps. */
export function compactSection(section: DashboardSection): DashboardSection {
  return withGridItems(section, compact(gridItems(section)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Moves a widget by whole cells, pushing the others out of the way like a drag does. */
export function moveWidget(
  section: DashboardSection,
  id: string,
  dx: number,
  dy: number,
): DashboardSection {
  const items = cloneLayout(gridItems(section));
  const item = items.find(({ i }) => i === id);
  if (!item) return section;
  const x = clamp(item.x + dx, 0, GRID_COLUMNS - item.w);
  const y = Math.max(0, item.y + dy);
  const moved = moveElement(items, item, x, y, true, false, "vertical", GRID_COLUMNS);
  return withGridItems(section, compact(moved));
}

/** Grows or shrinks a widget by whole cells; it keeps its corner and stays inside the columns. */
export function resizeWidget(
  section: DashboardSection,
  id: string,
  dw: number,
  dh: number,
): DashboardSection {
  const items = gridItems(section).map((item) =>
    item.i === id
      ? {
          ...item,
          w: clamp(item.w + dw, 1, GRID_COLUMNS - item.x),
          h: clamp(item.h + dh, 1, MAX_ROWS_PER_WIDGET),
        }
      : item,
  );
  return withGridItems(section, compact(items));
}

function fits(place: WidgetLayout, taken: readonly WidgetLayout[]): boolean {
  return taken.every(
    (other) =>
      place.x >= other.x + other.w ||
      other.x >= place.x + place.w ||
      place.y >= other.y + other.h ||
      other.y >= place.y + place.h,
  );
}

/**
 * Lays the widgets out in the given reading order, keeping their sizes: each one takes the first free place
 * at or after the previous one's, then the section is compacted.
 */
export function packInOrder(section: DashboardSection, order: readonly string[]): DashboardSection {
  const byId = new Map(section.widgets.map((widget) => [widget.id, widget]));
  const taken: WidgetLayout[] = [];
  const placed: WidgetConfig[] = [];
  let cursor = { x: 0, y: 0 };

  for (const id of order) {
    const widget = byId.get(id);
    if (!widget) continue;
    const w = Math.min(widget.layout.w, GRID_COLUMNS);
    const { h } = widget.layout;
    let place: WidgetLayout | undefined;
    for (let y = cursor.y; !place; y += 1) {
      for (let x = y === cursor.y ? cursor.x : 0; x + w <= GRID_COLUMNS && !place; x += 1) {
        if (fits({ x, y, w, h }, taken)) place = { x, y, w, h };
      }
    }
    taken.push(place);
    placed.push({ ...widget, layout: place });
    cursor = { x: place.x + w, y: place.y };
  }
  const rest = section.widgets.filter((widget) => !order.includes(widget.id));
  return compactSection({ ...section, widgets: [...placed, ...rest] });
}

/** Phones (D30): moves a widget `delta` places in the reading order and re-packs the section. */
export function reorderWidget(
  section: DashboardSection,
  id: string,
  delta: number,
): DashboardSection {
  const order = readingOrder(section).map((widget) => widget.id);
  const from = order.indexOf(id);
  const to = clamp(from + delta, 0, order.length - 1);
  if (from < 0 || from === to) return section;
  const next = order.toSpliced(from, 1).toSpliced(to, 0, id);
  return packInOrder(section, next);
}

/** Where a new widget of this size goes: below everything else, on the left. */
export function placeAtEnd(section: DashboardSection, w: number, h: number): WidgetLayout {
  const bottom = Math.max(0, ...section.widgets.map(({ layout }) => layout.y + layout.h));
  return { x: 0, y: bottom, w: clamp(w, 1, GRID_COLUMNS), h: clamp(h, 1, MAX_ROWS_PER_WIDGET) };
}
