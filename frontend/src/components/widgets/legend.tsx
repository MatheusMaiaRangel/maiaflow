import { cssColor, type ColorRef } from "@/lib/widgets/colors";

export type LegendItem = { label: string; color: ColorRef; value?: string };

/**
 * Names the series next to their color (identity never depends on color alone). Decorative for screen
 * readers: the chart's summary and the numbers table carry the same information.
 */
export function Legend({ items }: { items: readonly LegendItem[] }) {
  return (
    <ul aria-hidden className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map(({ label, color, value }) => (
        <li key={label} className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: cssColor(color) }}
          />
          {label}
          {value === undefined ? null : (
            <span className="font-medium text-foreground tabular-nums">{value}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
