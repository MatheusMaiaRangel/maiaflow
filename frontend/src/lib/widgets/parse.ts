/**
 * Reads a dashboard that came from outside (the API, D28) into a {@link DashboardConfig}. Only the shape
 * is checked here: unknown properties are dropped and `null` optional fields become absent. The rules
 * (known metrics, colors, layout, ...) are {@link dashboardErrors}'s job.
 */
import type { DateOnly } from "@/lib/dates";
import type {
  Grouping,
  HabitFilter,
  Metric,
  Period,
  PeriodPreset,
  Variable,
} from "@/lib/metrics/types";
import type { ColorRef } from "./colors";
import {
  SERIES_MARKS,
  type ChartType,
  type DashboardConfig,
  type DashboardSection,
  type SeriesConfig,
  type WidgetConfig,
  type WidgetLayout,
} from "./config";

/** Thrown inside the parser; never leaves {@link parseDashboardConfig}. */
class ShapeError extends Error {}

type Fields = Record<string, unknown>;

function fields(value: unknown): Fields {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ShapeError();
  return value as Fields;
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new ShapeError();
  return value;
}

function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ShapeError();
  return value;
}

function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new ShapeError();
  return value;
}

/** `undefined` for a missing or `null` field, otherwise what `read` makes of it. */
function optional<T>(value: unknown, read: (value: unknown) => T): T | undefined {
  return value === undefined || value === null ? undefined : read(value);
}

function metric(value: unknown): Metric {
  const raw = fields(value);
  const divideBy = optional(raw.divideBy, text);
  return {
    variable: text(raw.variable) as Variable,
    ...(divideBy === undefined ? {} : { divideBy: divideBy as Variable }),
  };
}

function mark(value: unknown): SeriesConfig["mark"] {
  const name = text(value);
  if (!(SERIES_MARKS as readonly string[]).includes(name)) throw new ShapeError();
  return name as SeriesConfig["mark"];
}

function series(value: unknown): SeriesConfig {
  const raw = fields(value);
  const seriesMark = optional(raw.mark, mark);
  return {
    metric: metric(raw.metric),
    label: text(raw.label),
    color: text(raw.color) as ColorRef,
    ...(seriesMark === undefined ? {} : { mark: seriesMark }),
  };
}

function period(value: unknown): Period {
  const raw = fields(value);
  switch (raw.kind) {
    case "last":
    case "next":
      return { kind: raw.kind, days: count(raw.days) as PeriodPreset };
    case "custom":
      return { kind: "custom", from: text(raw.from) as DateOnly, to: text(raw.to) as DateOnly };
    default:
      throw new ShapeError();
  }
}

function habitFilter(value: unknown): HabitFilter {
  const raw = fields(value);
  if (raw.kind === "all") return { kind: "all" };
  if (raw.kind === "habit") return { kind: "habit", habitId: count(raw.habitId) };
  throw new ShapeError();
}

function layout(value: unknown): WidgetLayout {
  const raw = fields(value);
  return { x: count(raw.x), y: count(raw.y), w: count(raw.w), h: count(raw.h) };
}

function widget(value: unknown): WidgetConfig {
  const raw = fields(value);
  const stacked = optional(raw.stacked, (flag) => {
    if (typeof flag !== "boolean") throw new ShapeError();
    return flag;
  });
  const background = optional(raw.background, text);
  return {
    id: text(raw.id),
    title: text(raw.title),
    chart: text(raw.chart) as ChartType,
    series: list(raw.series).map(series),
    grouping: text(raw.grouping) as Grouping,
    period: period(raw.period),
    habitFilter: habitFilter(raw.habitFilter),
    ...(stacked === undefined ? {} : { stacked }),
    ...(background === undefined ? {} : { background: background as ColorRef }),
    layout: layout(raw.layout),
  };
}

function section(value: unknown): DashboardSection {
  const raw = fields(value);
  return { id: text(raw.id), title: text(raw.title), widgets: list(raw.widgets).map(widget) };
}

/** The configuration, or `null` when `value` does not have its shape. */
export function parseDashboardConfig(value: unknown): DashboardConfig | null {
  try {
    const raw = fields(value);
    if (raw.version !== 1) return null;
    return { version: 1, sections: list(raw.sections).map(section) };
  } catch (error) {
    if (error instanceof ShapeError) return null;
    throw error;
  }
}
