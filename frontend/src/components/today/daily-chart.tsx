import { statusMeta } from "@/components/calendar/status-meta";
import {
  barHeight,
  chartMax,
  formatDayMonth,
  sumDays,
  toChartDays,
  type ChartDay,
  type StatusTotals,
} from "@/lib/dashboard";
import type { HabitStatsDay } from "@/lib/habits/stats";
import type { OccurrenceStatus } from "@/lib/habits/occurrences";
import { cn } from "@/lib/utils";

/** Stacking order, bottom to top, with the words used in labels and the legend. */
const SERIES: readonly {
  key: keyof StatusTotals;
  status: OccurrenceStatus;
  legend: string;
  one: string;
  many: string;
}[] = [
  { key: "completed", status: "Completed", legend: "Feitos", one: "feito", many: "feitos" },
  {
    key: "notCompleted",
    status: "NotCompleted",
    legend: "Não feitos",
    one: "não feito",
    many: "não feitos",
  },
  { key: "pending", status: "Pending", legend: "Pendentes", one: "pendente", many: "pendentes" },
];

/** "2 feitos, 1 não feito, 0 pendentes" */
export function describeTotals(totals: StatusTotals): string {
  return SERIES.map(
    ({ key, one, many }) => `${totals[key]} ${totals[key] === 1 ? one : many}`,
  ).join(", ");
}

/**
 * "Últimos 30 dias": one stacked bar per day (done at the bottom, then not done, then still pending), in the
 * colors of the calendar. Drawn with plain elements; screen readers get a summary and a table of the numbers.
 */
export function DailyChart({ days }: { days: readonly HabitStatsDay[] }) {
  const chartDays = toChartDays(days);
  const max = chartMax(chartDays);
  const summary = `Últimos ${days.length} dias: ${describeTotals(sumDays(days))}`;

  return (
    <div className="grid gap-3">
      <Legend />
      <div role="img" aria-label={summary} className="flex h-40 items-end gap-px sm:gap-0.5">
        {chartDays.map((day) => (
          <DayBar key={day.day} day={day} max={max} />
        ))}
      </div>
      {chartDays.length > 0 ? (
        <div aria-hidden className="flex justify-between text-xs text-muted-foreground">
          <span>{formatDayMonth(chartDays[0].day)}</span>
          <span>{formatDayMonth(chartDays[chartDays.length - 1].day)}</span>
        </div>
      ) : null}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Ver os números</summary>
        <DaysTable days={chartDays} />
      </details>
    </div>
  );
}

function Legend() {
  return (
    <ul aria-hidden className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {SERIES.map(({ status, legend }) => (
        <li key={status} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm", statusMeta(status).barClass)} />
          {legend}
        </li>
      ))}
    </ul>
  );
}

function DayBar({ day, max }: { day: ChartDay; max: number }) {
  const tooltip = `${formatDayMonth(day.day)}: ${describeTotals(day)}`;
  return (
    <div title={tooltip} className="flex h-full min-w-0 flex-1 flex-col justify-end">
      {day.total === 0 ? (
        <div className="h-0.5 rounded-full bg-border" />
      ) : (
        <div
          className="flex flex-col-reverse gap-px overflow-hidden rounded-t-sm"
          style={{ height: barHeight(day.total, max) }}
        >
          {SERIES.filter(({ key }) => day[key] > 0).map(({ key, status }) => (
            <div
              key={key}
              className={cn("min-h-0.5 basis-0", statusMeta(status).barClass)}
              style={{ flexGrow: day[key] }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DaysTable({ days }: { days: readonly ChartDay[] }) {
  return (
    <div className="mt-2 max-h-64 overflow-y-auto">
      <table className="w-full text-left text-xs tabular-nums">
        <caption className="sr-only">Hábitos por dia</caption>
        <thead className="text-muted-foreground">
          <tr>
            <th scope="col" className="py-1 font-medium">
              Dia
            </th>
            {SERIES.map(({ key, legend }) => (
              <th key={key} scope="col" className="py-1 text-right font-medium">
                {legend}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.day} className="border-t">
              <th scope="row" className="py-1 font-normal">
                {formatDayMonth(day.day)}
              </th>
              {SERIES.map(({ key }) => (
                <td key={key} className="py-1 text-right">
                  {day[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
