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
export const MAX_SECTION_TITLE_LENGTH = 40;
/** Limits of a stored dashboard (D28); the API checks the same. */
export const MAX_SECTIONS = 8;
export const MAX_WIDGETS = 30;
export const SERIES_MARKS = ["bar", "line", "area"] as const;
const ID_PATTERN = /^[a-z0-9-]{1,40}$/;
/** Same set as .NET's `char.IsControl`; the API refuses them too (PostgreSQL's jsonb cannot store U+0000). */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const CONTROL_CHARACTERS_MESSAGE = "Os textos não podem ter caracteres de controle.";

export type SeriesConfig = {
  metric: Metric;
  label: string;
  color: ColorRef;
  /** In bar, line and area charts, draws this series with another mark (bars with a line on top). */
  mark?: (typeof SERIES_MARKS)[number];
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
    CONTROL_CHARACTERS.test(widget.title) ||
    widget.series.some(({ label }) => CONTROL_CHARACTERS.test(label))
  ) {
    errors.push(CONTROL_CHARACTERS_MESSAGE);
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

/** Section and widget ids: lower-case letters, digits and dashes, at most 40. */
export function isConfigId(value: string): boolean {
  return ID_PATTERN.test(value);
}

/** Whether two places in a section share a cell. */
export function overlaps(a: WidgetLayout, b: WidgetLayout): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function sectionErrors(section: DashboardSection): string[] {
  const errors: string[] = [];
  if (!isConfigId(section.id)) errors.push("Identificador de seção inválido.");
  const title = section.title.trim();
  if (title.length === 0 || title.length > MAX_SECTION_TITLE_LENGTH) {
    errors.push(`O nome da seção precisa ter de 1 a ${MAX_SECTION_TITLE_LENGTH} caracteres.`);
  }
  if (CONTROL_CHARACTERS.test(section.title)) errors.push(CONTROL_CHARACTERS_MESSAGE);
  const { widgets } = section;
  if (widgets.some((a, i) => widgets.slice(i + 1).some((b) => overlaps(a.layout, b.layout)))) {
    errors.push(`Há gráficos um sobre o outro em "${title}".`);
  }
  return errors;
}

/**
 * Why the dashboard cannot be stored (Brazilian Portuguese); empty when it is valid. The API checks the same
 * rules (D28) against `contracts/dashboard-validation-cases.json`.
 */
export function dashboardErrors(config: DashboardConfig): string[] {
  const errors: string[] = [];
  if (config.version !== 1) errors.push("Versão do painel desconhecida.");
  if (config.sections.length > MAX_SECTIONS) errors.push(`Use no máximo ${MAX_SECTIONS} seções.`);

  const sectionIds = config.sections.map((section) => section.id);
  if (new Set(sectionIds).size !== sectionIds.length) errors.push("Há seções repetidas.");
  const widgets = config.sections.flatMap((section) => section.widgets);
  if (widgets.length > MAX_WIDGETS) errors.push(`Use no máximo ${MAX_WIDGETS} gráficos.`);
  const widgetIds = widgets.map((widget) => widget.id);
  if (new Set(widgetIds).size !== widgetIds.length) errors.push("Há gráficos repetidos.");
  if (widgetIds.some((id) => !isConfigId(id))) errors.push("Identificador de gráfico inválido.");

  for (const section of config.sections) errors.push(...sectionErrors(section));
  for (const widget of widgets) {
    errors.push(
      ...widgetErrors(widget).map((error) => `${widget.title.trim() || "Gráfico"}: ${error}`),
    );
  }
  return errors;
}
