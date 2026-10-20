"use client";

import { Pie, PieChart, Tooltip, type TooltipContentProps, type TooltipValueType } from "recharts";
import type { MetricResult } from "@/lib/metrics/types";
import { cssColor, PALETTE_COLORS, type ColorRef } from "@/lib/widgets/colors";
import type { WidgetConfig } from "@/lib/widgets/config";
import { ChartTooltipCard } from "./chart-tooltip";
import { Legend } from "./legend";

export type Slice = { label: string; value: number; color: ColorRef };

/**
 * The slices of a donut: one per series when there is no grouping, otherwise one per bucket of the single
 * series (colors then follow the palette in its fixed order, starting at the series color's slot).
 */
export function slicesOf(widget: WidgetConfig, result: MetricResult): Slice[] {
  if (widget.grouping === "none") {
    return widget.series.map((series, index) => ({
      label: series.label,
      value: result.series[index].values[0] ?? 0,
      color: series.color,
    }));
  }
  const hues = PALETTE_COLORS.slice(0, 8);
  const start = Math.max(0, hues.indexOf(widget.series[0].color as (typeof hues)[number]));
  return result.buckets.map((bucket, index) => ({
    label: bucket.label,
    value: result.series[0].values[index] ?? 0,
    color: hues[(start + index) % hues.length],
  }));
}

/** Counts as parts of a whole, with the total in the middle and every slice named with its number. */
export function DonutChart({
  widget,
  result,
  height,
}: {
  widget: WidgetConfig;
  result: MetricResult;
  height: number;
}) {
  const slices = slicesOf(widget, result);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const data = slices
    .filter((slice) => slice.value > 0)
    .map((slice) => ({ ...slice, fill: cssColor(slice.color) }));

  const renderTooltip = ({
    active,
    payload,
  }: TooltipContentProps<TooltipValueType, string | number>) => {
    const slice = payload?.[0]?.payload as Slice | undefined;
    if (!active || !slice) return null;
    return (
      <ChartTooltipCard
        title={slice.label}
        rows={[{ label: "Total", color: slice.color, value: slice.value, unit: "count" }]}
      />
    );
  };

  return (
    <div className="grid min-w-0 content-start gap-3">
      <div className="relative">
        <PieChart responsive style={{ width: "100%", height }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="62%"
            outerRadius="100%"
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="var(--card)"
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Tooltip content={renderTooltip} />
        </PieChart>
        <p
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        >
          <span className="text-2xl font-semibold tabular-nums">{total}</span>
          <span className="text-xs text-muted-foreground">no total</span>
        </p>
      </div>
      <Legend
        items={slices.map(({ label, color, value }) => ({ label, color, value: String(value) }))}
      />
    </div>
  );
}
