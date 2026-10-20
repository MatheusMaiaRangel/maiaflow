"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";
import type { MetricResult } from "@/lib/metrics/types";
import { cssColor } from "@/lib/widgets/colors";
import type { SeriesConfig, WidgetConfig } from "@/lib/widgets/config";
import { formatValue } from "@/lib/widgets/format";
import { ChartTooltipCard } from "./chart-tooltip";
import { Legend } from "./legend";

const AXIS_TICK = { fontSize: 12, fill: "var(--muted-foreground)" };
const BAR_RADIUS = 4;

type Row = { label: string; bucketIndex: number } & Record<string, number | string | null>;

function seriesKey(index: number): string {
  return `s${index}`;
}

function rowsOf(result: MetricResult): Row[] {
  return result.buckets.map((bucket, bucketIndex) => ({
    label: bucket.label,
    bucketIndex,
    ...Object.fromEntries(
      result.series.map((series, index) => [seriesKey(index), series.values[bucketIndex]]),
    ),
  }));
}

function markOf(widget: WidgetConfig, series: SeriesConfig): "bar" | "line" | "area" {
  return (
    series.mark ?? (widget.chart === "line" ? "line" : widget.chart === "area" ? "area" : "bar")
  );
}

/**
 * Bar, line and area charts, one shared axis (series of one widget always share a unit). A series may use
 * another mark than the chart's ("Concluídas" as bars with "Criadas" as a line).
 */
export function CartesianChart({
  widget,
  result,
  height,
}: {
  widget: WidgetConfig;
  result: MetricResult;
  /** Any CSS length, e.g. a custom property that changes with the screen width. */
  height: number | string;
}) {
  const unit = result.series[0]?.unit ?? "count";
  const lastBar = widget.series.findLastIndex((series) => markOf(widget, series) === "bar");
  const stackId = widget.stacked ? "stack" : undefined;

  const renderTooltip = ({
    active,
    payload,
  }: TooltipContentProps<TooltipValueType, string | number>) => {
    if (!active || !payload?.length) return null;
    const { bucketIndex } = payload[0].payload as Row;
    return (
      <ChartTooltipCard
        title={result.buckets[bucketIndex].label}
        rows={widget.series.map((series, index) => ({
          label: series.label,
          color: series.color,
          value: result.series[index].values[bucketIndex] ?? null,
          unit: result.series[index].unit,
        }))}
      />
    );
  };

  return (
    <div className="grid min-w-0 gap-3">
      {widget.series.length > 1 ? (
        <Legend items={widget.series.map(({ label, color }) => ({ label, color }))} />
      ) : null}
      <ComposedChart
        responsive
        data={rowsOf(result)}
        style={{ width: "100%", height }}
        margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={unit === "percent" ? 40 : 28}
          allowDecimals={false}
          domain={unit === "percent" ? [0, 100] : [0, "auto"]}
          tickFormatter={(value: number) => formatValue(value, unit === "streak" ? "count" : unit)}
        />
        <Tooltip content={renderTooltip} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
        {widget.series.map((series, index) => {
          const color = cssColor(series.color);
          const key = seriesKey(index);
          switch (markOf(widget, series)) {
            case "line":
              return (
                <Line
                  key={key}
                  dataKey={key}
                  name={series.label}
                  type="linear"
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              );
            case "area":
              return (
                <Area
                  key={key}
                  dataKey={key}
                  name={series.label}
                  type="linear"
                  stroke={color}
                  strokeWidth={2}
                  fill={color}
                  fillOpacity={0.2}
                  stackId={stackId}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              );
            case "bar": {
              const isTop = !stackId || index === lastBar;
              return (
                <Bar
                  key={key}
                  dataKey={key}
                  name={series.label}
                  fill={color}
                  stackId={stackId}
                  maxBarSize={28}
                  radius={isTop ? [BAR_RADIUS, BAR_RADIUS, 0, 0] : 0}
                  stroke="var(--card)"
                  strokeWidth={stackId ? 1 : 0}
                  isAnimationActive={false}
                />
              );
            }
          }
        })}
      </ComposedChart>
    </div>
  );
}
