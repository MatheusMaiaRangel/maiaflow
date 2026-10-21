"use client";

import { ChartColumnIcon } from "lucide-react";
import Link from "next/link";
import { useId, type CSSProperties, type ReactNode } from "react";
import { SectionError } from "@/components/today/section-states";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isHabitVariable } from "@/lib/metrics/catalog";
import type { MetricResult } from "@/lib/metrics/types";
import { mixColor } from "@/lib/widgets/colors";
import { GRID_COLUMNS, MAX_ROW, type WidgetConfig } from "@/lib/widgets/config";
import type { WidgetState } from "@/lib/widgets/data";
import { formatPeriod, hasValues } from "@/lib/widgets/format";
import { cn } from "@/lib/utils";
import { WidgetBody } from "./widget-body";

/** Height of a chart on wide screens, by the rows the widget spans (a two-row chart matches two cards). */
const ROW_CHART_HEIGHT = 250;
const CHART_CHROME = 90;
/** Columns of a section between phones and wide screens. */
const SMALL_SCREEN_COLUMNS = 2;

function usesHabits(widget: WidgetConfig): boolean {
  return widget.series.some(
    ({ metric }) =>
      isHabitVariable(metric.variable) ||
      (metric.divideBy !== undefined && isHabitVariable(metric.divideBy)),
  );
}

/** Place and size in the section grid, as custom properties read by the classes below. */
function gridStyle(widget: WidgetConfig): CSSProperties {
  const { x, y, w, h } = widget.layout;
  return {
    "--x": Math.min(x, GRID_COLUMNS - 1) + 1,
    "--y": Math.min(Math.max(0, y), MAX_ROW) + 1,
    "--w": Math.min(w, GRID_COLUMNS),
    "--w-sm": Math.min(w, SMALL_SCREEN_COLUMNS),
    "--h": h,
    "--chart-h-lg": `${h * ROW_CHART_HEIGHT - CHART_CHROME}px`,
    ...(widget.background ? { backgroundColor: mixColor(widget.background, 14) } : {}),
  } as CSSProperties;
}

function EmptyWidget({ widget }: { widget: WidgetConfig }) {
  const habits = usesHabits(widget);
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <ChartColumnIcon className="size-6 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">Nada para mostrar neste período ainda.</p>
      <Link
        href={habits ? "/habits" : "/tasks"}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {habits ? "Ver hábitos" : "Ver tarefas"}
      </Link>
    </div>
  );
}

/**
 * A number always shows (a "—" says enough); a list is empty only without rows (a new habit shows "—");
 * charts are empty when every value is zero or missing.
 */
function isEmpty(widget: WidgetConfig, result: MetricResult): boolean {
  if (widget.chart === "number") return false;
  if (widget.chart === "list") return result.buckets.length === 0;
  return !hasValues(result);
}

function Body({ widget, state }: { widget: WidgetConfig; state: WidgetState }) {
  switch (state.status) {
    case "loading":
      return (
        <Skeleton
          role="status"
          aria-label={`Carregando ${widget.title}`}
          className="h-(--chart-h) min-h-24 w-full"
        />
      );
    case "error":
      return <SectionError what={state.what} onRetry={state.retry} compact />;
    case "invalid":
      return (
        <p role="alert" className="text-sm text-muted-foreground">
          Este gráfico não pode ser exibido: {state.errors.join(" ")}
        </p>
      );
    case "ready":
      return isEmpty(widget, state.result) ? (
        <EmptyWidget widget={widget} />
      ) : (
        <WidgetBody widget={widget} result={state.result} />
      );
  }
}

type WidgetCardProps = {
  widget: WidgetConfig;
  state: WidgetState;
  /** Buttons shown next to the title (the editor's edit and delete). */
  actions?: ReactNode;
  /** Something before the title (the editor's drag handle). */
  leading?: ReactNode;
  /**
   * A fixed chart height in pixels: the card fills its container (the editor's grid and the preview)
   * instead of placing itself in the section grid.
   */
  chartHeight?: number;
};

function fillStyle(widget: WidgetConfig, chartHeight: number): CSSProperties {
  return {
    "--chart-h": `${chartHeight}px`,
    ...(widget.background ? { backgroundColor: mixColor(widget.background, 14) } : {}),
  } as CSSProperties;
}

/**
 * One widget of the dashboard: a card with its title and period, and loading, error and empty states of
 * its own. One column on phones, two on tablets, its configured place on wide screens.
 */
export function WidgetCard({ widget, state, actions, leading, chartHeight }: WidgetCardProps) {
  const headingId = useId();
  const fills = chartHeight !== undefined;
  return (
    <section
      aria-labelledby={headingId}
      style={fills ? fillStyle(widget, chartHeight) : gridStyle(widget)}
      className={cn(
        "grid min-w-0 content-start gap-3 rounded-xl border bg-card p-4",
        fills
          ? "h-full overflow-hidden"
          : [
              "[--chart-h:12rem] sm:[grid-column:span_var(--w-sm)]",
              "lg:[grid-column:var(--x)/span_var(--w)] lg:[grid-row:var(--y)/span_var(--h)] lg:[--chart-h:var(--chart-h-lg)]",
            ],
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          {leading}
          <h3 id={headingId} className="min-w-0 font-medium break-words">
            {widget.title}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">{formatPeriod(widget.period)}</p>
          {actions}
        </div>
      </header>
      <Body widget={widget} state={state} />
    </section>
  );
}
