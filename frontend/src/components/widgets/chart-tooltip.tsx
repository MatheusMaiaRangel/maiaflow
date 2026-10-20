import type { Unit } from "@/lib/metrics/types";
import { cssColor, type ColorRef } from "@/lib/widgets/colors";
import { formatValue } from "@/lib/widgets/format";

export type TooltipRow = { label: string; color: ColorRef; value: number | null; unit: Unit };

/** The hover card of the charts: the bucket, then one row per series in the chart's order. */
export function ChartTooltipCard({ title, rows }: { title: string; rows: readonly TooltipRow[] }) {
  return (
    <div className="grid gap-1 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-sm"
            style={{ backgroundColor: cssColor(row.color) }}
          />
          <span className="text-muted-foreground">{row.label}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums">
            {formatValue(row.value, row.unit)}
          </span>
        </p>
      ))}
    </div>
  );
}
