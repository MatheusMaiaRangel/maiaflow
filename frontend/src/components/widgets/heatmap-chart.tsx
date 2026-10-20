import { weekdayOf } from "@/lib/dates";
import { WEEKDAY_SHORT } from "@/lib/metrics/buckets";
import type { MetricResult, SeriesResult } from "@/lib/metrics/types";
import { mixColor, type ColorRef } from "@/lib/widgets/colors";
import type { WidgetConfig } from "@/lib/widgets/config";
import { formatValue } from "@/lib/widgets/format";

/** Steps of the scale, from "a little" to "the most"; zero and "nothing to measure" have their own look. */
const LEVELS = [25, 50, 75, 100] as const;
const MIN_SHARE = 30;
const DAYS_PER_WEEK = 7;
const LABEL_WIDTH = "1.75rem";
/** Squares grow with the card up to this size. */
const MAX_CELL = "1.75rem";

/** 0 for zero, 1–4 by share of the maximum (100 for percentages), `null` when there is nothing to measure. */
export function levelOf(value: number | null, max: number): number | null {
  if (value === null) return null;
  if (value <= 0 || max <= 0) return 0;
  const share = (value / max) * 100;
  return LEVELS.findIndex((limit) => share <= limit) + 1;
}

function cellColor(level: number | null, color: ColorRef): string | undefined {
  if (level === null || level === 0) return undefined;
  return mixColor(color, MIN_SHARE + ((100 - MIN_SHARE) * level) / LEVELS.length, "var(--muted)");
}

function maxOf(series: SeriesResult): number {
  if (series.unit === "percent") return 100;
  return Math.max(0, ...series.values.map((value) => value ?? 0));
}

/**
 * One square per day, a column per week (Sunday on top), colored by the value. Hovering a square shows its
 * day and value; screen readers get the numbers table instead.
 */
export function HeatmapChart({ widget, result }: { widget: WidgetConfig; result: MetricResult }) {
  const series = result.series[0];
  const color = widget.series[0].color;
  const max = maxOf(series);
  const firstDay = result.buckets[0]?.key;
  const offset = firstDay ? weekdayOf(firstDay) : 0;

  const weeks = Math.ceil((offset + result.buckets.length) / DAYS_PER_WEEK);

  return (
    <div className="grid min-w-0 gap-2">
      <div
        aria-hidden
        className="grid grid-flow-col grid-rows-7 gap-[3px] text-[10px] leading-none text-muted-foreground"
        style={{
          gridTemplateColumns: `${LABEL_WIDTH} repeat(${weeks}, minmax(0, 1fr))`,
          maxWidth: `calc(${LABEL_WIDTH} + ${weeks} * ${MAX_CELL})`,
        }}
      >
        {WEEKDAY_SHORT.map((day, index) => (
          <span key={day} className="self-center">
            {index % 2 === 1 ? day : ""}
          </span>
        ))}
        {Array.from({ length: offset }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}
        {result.buckets.map((bucket, index) => {
          const value = series.values[index];
          const level = levelOf(value, max);
          return (
            <span
              key={bucket.key}
              title={`${bucket.label}: ${formatValue(value, series.unit)}`}
              data-level={level ?? "none"}
              className={
                level === null
                  ? "aspect-square rounded-[3px] border border-dashed border-border"
                  : "aspect-square rounded-[3px] bg-muted"
              }
              style={{ backgroundColor: cellColor(level, color) }}
            />
          );
        })}
      </div>
      <div aria-hidden className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="mr-1">Menos</span>
        {[0, ...LEVELS.map((_, index) => index + 1)].map((level) => (
          <span
            key={level}
            className="size-3 rounded-[3px] bg-muted"
            style={{ backgroundColor: cellColor(level, color) }}
          />
        ))}
        <span className="ml-1">Mais</span>
        <span className="ml-3 inline-flex items-center gap-1">
          <span className="size-3 rounded-[3px] border border-dashed border-border" />
          Sem nada previsto
        </span>
      </div>
    </div>
  );
}
