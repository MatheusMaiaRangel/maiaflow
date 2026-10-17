import { statusMeta } from "@/components/calendar/status-meta";
import { formatPercent, formatStreak, habitRates } from "@/lib/dashboard";
import type { HabitStatsItem } from "@/lib/habits/stats";
import { cn } from "@/lib/utils";

/**
 * "Por hábito": one horizontal bar per habit with its completion rate and current streak, best rate first.
 * Every number is also written out, so the bars themselves are decorative.
 */
export function HabitRatesChart({ habits }: { habits: readonly HabitStatsItem[] }) {
  return (
    <ul aria-label="Conclusão por hábito" className="grid gap-4">
      {habitRates(habits).map((habit) => (
        <li key={habit.habitId} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 font-medium break-words">{habit.title}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {formatPercent(habit.percent)}
            </span>
          </div>
          <div aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", statusMeta("Completed").barClass)}
              style={{ width: `${habit.percent ?? 0}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Sequência atual: {formatStreak(habit.streak)}
          </p>
        </li>
      ))}
    </ul>
  );
}
