import type { MetricResult } from "@/lib/metrics/types";
import { cssColor } from "@/lib/widgets/colors";
import type { WidgetConfig } from "@/lib/widgets/config";
import { formatValue } from "@/lib/widgets/format";

/** Rows best first by the first series; empty measurements go last and ties keep the bucket order. */
export function rankedRows(result: MetricResult): number[] {
  const first = result.series[0]?.values ?? [];
  return result.buckets
    .map((_, index) => index)
    .toSorted((a, b) => {
      const left = first[a];
      const right = first[b];
      if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
      if (right === null || right === undefined) return -1;
      return right - left;
    });
}

/**
 * One row per bucket: the first series is the main number (with a bar when it is a percentage), the others
 * are written below it. Every number is text, so the bars are decorative.
 */
export function ListWidget({ widget, result }: { widget: WidgetConfig; result: MetricResult }) {
  const [main, ...others] = result.series;
  const mainConfig = widget.series[0];

  return (
    <ul aria-label={widget.title} className="grid content-start gap-4">
      {rankedRows(result).map((bucketIndex) => {
        const bucket = result.buckets[bucketIndex];
        const value = main.values[bucketIndex];
        return (
          <li key={bucket.key} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 font-medium break-words">{bucket.label}</span>
              <span className="shrink-0 font-semibold tabular-nums">
                <span className="sr-only">{mainConfig.label}: </span>
                {formatValue(value, main.unit)}
              </span>
            </div>
            {main.unit === "percent" ? (
              <div aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${value ?? 0}%`, backgroundColor: cssColor(mainConfig.color) }}
                />
              </div>
            ) : null}
            {others.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {others
                  .map(
                    (series, index) =>
                      `${widget.series[index + 1].label}: ${formatValue(series.values[bucketIndex], series.unit)}`,
                  )
                  .join(" · ")}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
