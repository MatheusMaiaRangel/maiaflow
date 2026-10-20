import type { MetricResult } from "@/lib/metrics/types";
import { cssColor } from "@/lib/widgets/colors";
import type { WidgetConfig } from "@/lib/widgets/config";
import { formatValue } from "@/lib/widgets/format";

/** One big number. Ratios also say what they were made of ("18 de 22"). */
export function NumberWidget({ widget, result }: { widget: WidgetConfig; result: MetricResult }) {
  const series = result.series[0];
  const config = widget.series[0];
  const numerator = series.parts?.numerator[0];
  const denominator = series.parts?.denominator[0];

  return (
    <div className="grid content-start gap-1">
      <p className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-8 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: cssColor(config.color) }}
        />
        <span className="text-3xl font-semibold tabular-nums">
          {formatValue(series.values[0], series.unit)}
        </span>
      </p>
      <p className="text-sm text-muted-foreground">
        {config.label}
        {numerator !== undefined && denominator !== undefined && denominator > 0
          ? `: ${numerator} de ${denominator}`
          : null}
      </p>
    </div>
  );
}
