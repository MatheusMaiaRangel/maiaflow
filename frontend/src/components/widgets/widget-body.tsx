"use client";

import type { MetricResult } from "@/lib/metrics/types";
import type { WidgetConfig } from "@/lib/widgets/config";
import { describeSeries } from "@/lib/widgets/format";
import { CartesianChart } from "./cartesian-chart";
import { DonutChart } from "./donut-chart";
import { HeatmapChart } from "./heatmap-chart";
import { ListWidget } from "./list-widget";
import { NumberWidget } from "./number-widget";
import { NumbersTable } from "./numbers-table";

/** Largest donut, so a tall card does not blow it up. */
const MAX_DONUT_HEIGHT = 208;

/** Draws the widget's numbers with the renderer of its chart type. */
export function WidgetBody({ widget, result }: { widget: WidgetConfig; result: MetricResult }) {
  const summary = `${widget.title}: ${describeSeries(
    result,
    widget.series.map((series) => series.label),
  )}`;

  switch (widget.chart) {
    case "number":
      return <NumberWidget widget={widget} result={result} />;
    case "list":
      return <ListWidget widget={widget} result={result} />;
    case "donut":
      return (
        <div className="grid gap-3">
          <figure role="img" aria-label={summary}>
            <DonutChart widget={widget} result={result} height={MAX_DONUT_HEIGHT} />
          </figure>
          <NumbersTable widget={widget} result={result} />
        </div>
      );
    case "heatmap":
      return (
        <div className="grid gap-3">
          <figure role="img" aria-label={summary}>
            <HeatmapChart widget={widget} result={result} />
          </figure>
          <NumbersTable widget={widget} result={result} />
        </div>
      );
    case "bar":
    case "line":
    case "area":
      return (
        <div className="grid gap-3">
          <figure role="img" aria-label={summary} className="min-w-0">
            <CartesianChart widget={widget} result={result} height="var(--chart-h)" />
          </figure>
          <NumbersTable widget={widget} result={result} />
        </div>
      );
  }
}
