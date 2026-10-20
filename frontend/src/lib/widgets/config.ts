/**
 * Typed configuration of the dashboard below the Today cards (D26). Phase 6 renders a fixed default set
 * written in this format; phase 7 lets the user edit and store it.
 */
import { VARIABLE_INFO } from "@/lib/metrics/catalog";
import { queryErrors } from "@/lib/metrics/engine";
import type { Grouping, HabitFilter, Metric, MetricQuery, Period, Unit } from "@/lib/metrics/types";
import { isColorRef, type ColorRef } from "./colors";

export const CHART_TYPES = ["bar", "line", "area", "donut", "number", "heatmap", "list"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

/** Columns of a section on wide screens; narrower screens use 2 and then 1. */
export const GRID_COLUMNS = 4;
export const MAX_ROWS_PER_WIDGET = 4;
/** Last row a widget may start on (keeps a stored layout from building a huge grid). */
export const MAX_ROW = 50;
export const MAX_SERIES = 6;
export const MAX_TITLE_LENGTH = 60;
export const MAX_LABEL_LENGTH = 40;

export type SeriesConfig = {
  metric: Metric;
  label: string;
  color: ColorRef;
  /** In bar, line and area charts, draws this series with another mark (bars with a line on top). */
  mark?: "bar" | "line" | "area";
};

/** Position and size in grid cells; `x` is 0-based and `x + w` stays within {@link GRID_COLUMNS}. */
export type WidgetLayout = { x: number; y: number; w: number; h: number };

export type WidgetConfig = {
  id: string;
  title: string;
  chart: ChartType;
  series: readonly SeriesConfig[];
  grouping: Grouping;
  period: Period;
  habitFilter: HabitFilter;
  /** Bar and area charts: stack the series instead of placing them side by side. */
  stacked?: boolean;
  /** Tints the card. */
  background?: ColorRef;
  layout: WidgetLayout;
};

export type DashboardSection = { id: string; title: string; widgets: readonly WidgetConfig[] };

export type DashboardConfig = { version: 1; sections: readonly DashboardSection[] };

export function widgetQuery(widget: WidgetConfig): MetricQuery {
  return {
    metrics: widget.series.map((series) => series.metric),
    grouping: widget.grouping,
    period: widget.period,
    habitFilter: widget.habitFilter,
  };
}

/** The unit each series is measured in (ratios are always percentages). */
export function seriesUnit(series: SeriesConfig): Unit {
  return series.metric.divideBy === undefined
    ? VARIABLE_INFO[series.metric.variable].unit
    : "percent";
}

function isWholeIn(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function layoutErrors({ x, y, w, h }: WidgetLayout): string[] {
  const fits =
    isWholeIn(x, 0, GRID_COLUMNS - 1) &&
    isWholeIn(w, 1, GRID_COLUMNS) &&
    x + w <= GRID_COLUMNS &&
    isWholeIn(y, 0, MAX_ROW) &&
    isWholeIn(h, 1, MAX_ROWS_PER_WIDGET);
  return fits ? [] : ["Posição ou tamanho inválido."];
}

function chartErrors(widget: WidgetConfig): string[] {
  const units = new Set(widget.series.map(seriesUnit));
  const count = widget.series.length;

  switch (widget.chart) {
    case "number":
      return count === 1 && widget.grouping === "none"
        ? []
        : ["O número mostra uma métrica, sem agrupamento."];
    case "heatmap":
      return count === 1 && widget.grouping === "day"
        ? []
        : ["O mapa mostra uma métrica agrupada por dia."];
    case "donut": {
      const slices =
        (widget.grouping === "none" && count >= 2) ||
        (count === 1 && (widget.grouping === "weekday" || widget.grouping === "habit"));
      const errors = slices
        ? []
        : ["A rosca precisa de várias métricas no total, ou uma por dia da semana ou por hábito."];
      return units.size === 1 && units.has("count")
        ? errors
        : [...errors, "A rosca só mostra contagens."];
    }
    case "bar":
    case "line":
    case "area": {
      const errors = units.size > 1 ? ["As séries de um gráfico precisam da mesma unidade."] : [];
      return widget.stacked && !units.has("count")
        ? [...errors, "Só contagens podem ser empilhadas."]
        : errors;
    }
    case "list":
      return [];
  }
}

/** Why the widget cannot be drawn (Brazilian Portuguese, for the builder); empty when it is valid. */
export function widgetErrors(widget: WidgetConfig): string[] {
  const errors: string[] = [];
  const title = widget.title.trim();
  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
    errors.push(`O título precisa ter de 1 a ${MAX_TITLE_LENGTH} caracteres.`);
  }
  if (!CHART_TYPES.includes(widget.chart)) return [...errors, "Tipo de gráfico desconhecido."];
  if (widget.series.length > MAX_SERIES) errors.push(`Use no máximo ${MAX_SERIES} métricas.`);
  if (
    widget.series.some(({ label }) => label.trim().length === 0 || label.length > MAX_LABEL_LENGTH)
  ) {
    errors.push(`Cada métrica precisa de um nome de 1 a ${MAX_LABEL_LENGTH} caracteres.`);
  }
  if (
    widget.series.some(({ color }) => !isColorRef(color)) ||
    (widget.background !== undefined && !isColorRef(widget.background))
  ) {
    errors.push("Cor inválida.");
  }

  const query = queryErrors(widgetQuery(widget));
  if (query.length > 0) return [...errors, ...query, ...layoutErrors(widget.layout)];
  return [...errors, ...chartErrors(widget), ...layoutErrors(widget.layout)];
}
