/** Words and numbers the widgets show (Brazilian Portuguese). */
import { formatDateShort } from "@/lib/dates";
import type { MetricResult, Period, Unit } from "@/lib/metrics/types";

export const NO_VALUE = "—";

/** "12", "73%", "1 seguida", "12 seguidas", or "—" when there is nothing to measure. */
export function formatValue(value: number | null, unit: Unit): string {
  if (value === null) return NO_VALUE;
  switch (unit) {
    case "count":
      return String(value);
    case "percent":
      return `${Math.round(value)}%`;
    case "streak":
      return `${value} ${value === 1 ? "seguida" : "seguidas"}`;
  }
}

/** "Últimos 30 dias", "Próximos 7 dias", "01/10/2026 a 15/10/2026". */
export function formatPeriod(period: Period): string {
  switch (period.kind) {
    case "last":
      return `Últimos ${period.days} dias`;
    case "next":
      return `Próximos ${period.days} dias`;
    case "custom":
      return `${formatDateShort(period.from)} a ${formatDateShort(period.to)}`;
  }
}

/** Whether there is anything to draw: some value that is not zero or empty. */
export function hasValues(result: MetricResult): boolean {
  return result.series.some((series) =>
    series.values.some((value) => value !== null && value !== 0),
  );
}

/**
 * One sentence per series for screen readers: totals for counts, the best bucket otherwise
 * ("Concluídas: 12 no total. Conclusão: maior valor 100% (Seg).").
 */
export function describeSeries(result: MetricResult, labels: readonly string[]): string {
  return result.series
    .map((series, index) => {
      const label = labels[index];
      if (series.unit === "count") {
        const total = series.values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
        return `${label}: ${total} no total.`;
      }
      const best = series.values.reduce<number | null>(
        (top, value, bucket) =>
          value !== null && (top === null || value > (series.values[top] ?? -Infinity))
            ? bucket
            : top,
        null,
      );
      return best === null
        ? `${label}: sem dados.`
        : `${label}: maior valor ${formatValue(series.values[best], series.unit)} (${result.buckets[best].label}).`;
    })
    .join(" ");
}
