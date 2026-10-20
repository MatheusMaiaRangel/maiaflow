import type { MetricResult } from "@/lib/metrics/types";
import type { WidgetConfig } from "@/lib/widgets/config";
import { formatValue } from "@/lib/widgets/format";

/** "Ver os números": every value of the widget as a table, for screen readers and exact reading. */
export function NumbersTable({ widget, result }: { widget: WidgetConfig; result: MetricResult }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">Ver os números</summary>
      <div className="mt-2 max-h-64 overflow-y-auto">
        <table className="w-full text-left text-xs tabular-nums">
          <caption className="sr-only">{widget.title}</caption>
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 font-medium">
                {widget.grouping === "habit"
                  ? "Hábito"
                  : widget.grouping === "none"
                    ? ""
                    : "Período"}
              </th>
              {widget.series.map((series) => (
                <th key={series.label} scope="col" className="py-1 text-right font-medium">
                  {series.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.buckets.map((bucket, bucketIndex) => (
              <tr key={bucket.key} className="border-t">
                <th scope="row" className="py-1 font-normal">
                  {bucket.label}
                </th>
                {result.series.map((series, index) => (
                  <td key={widget.series[index].label} className="py-1 text-right">
                    {formatValue(series.values[bucketIndex], series.unit)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
