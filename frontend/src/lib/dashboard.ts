/**
 * Numbers of the Today dashboards ("Resumo"). Pure functions over data the screen already has: today's
 * occurrences and tasks, and the completion history of `GET /api/habits/stats`.
 */
import { dateOnly, formatDateShort, type DateOnly } from "@/lib/dates";
import type { Occurrence } from "@/lib/habits/occurrences";
import type { HabitStatsDay, HabitStatsItem } from "@/lib/habits/stats";
import { habitProgress, taskProgress, type TodayTasks } from "@/lib/today";

/** Size of the window the dashboards show (decision D24 allows 7 to 90). */
export const DASHBOARD_DAYS = 30;

/** What is shown when a rate has nothing to count. */
export const NO_VALUE = "—";

export type Ratio = {
  done: number;
  total: number;
  /** Rounded percentage, or `null` when `total` is 0. */
  percent: number | null;
};

export function percentOf(done: number, total: number): number | null {
  return total > 0 ? Math.round((done / total) * 100) : null;
}

/** "73%", or "—" when there is nothing to count. */
export function formatPercent(percent: number | null): string {
  return percent === null ? NO_VALUE : `${percent}%`;
}

function ratio(done: number, total: number): Ratio {
  return { done, total, percent: percentOf(done, total) };
}

/** Habits done plus tasks done, out of everything that is for today (overdue tasks included). */
export function dayProgress(occurrences: readonly Occurrence[], tasks: TodayTasks): Ratio {
  const habits = habitProgress(occurrences);
  const todayTasks = taskProgress(tasks);
  return ratio(habits.done + todayTasks.done, habits.total + todayTasks.total);
}

export type TopStreak = { title: string; streak: number };

/** The habit with the highest current streak (the first one on a tie), or `undefined` with no habits. */
export function topStreak(habits: readonly HabitStatsItem[]): TopStreak | undefined {
  const best = habits.reduce<HabitStatsItem | undefined>(
    (top, habit) => (top === undefined || habit.currentStreak > top.currentStreak ? habit : top),
    undefined,
  );
  return best && { title: best.habitTitle, streak: best.currentStreak };
}

/** Streaks count occurrences in a row, not days: "seguida" / "seguidas". */
export function streakUnit(streak: number): string {
  return streak === 1 ? "seguida" : "seguidas";
}

/** "1 seguida", "12 seguidas". */
export function formatStreak(streak: number): string {
  return `${streak} ${streakUnit(streak)}`;
}

/** "14/10", for chart axes and tables. */
export function formatDayMonth(day: DateOnly): string {
  return formatDateShort(day).slice(0, 5);
}

export type StatusTotals = { completed: number; notCompleted: number; pending: number };

export function sumDays(days: readonly HabitStatsDay[]): StatusTotals {
  return days.reduce(
    (totals, day) => ({
      completed: totals.completed + day.completed,
      notCompleted: totals.notCompleted + day.notCompleted,
      pending: totals.pending + day.pending,
    }),
    { completed: 0, notCompleted: 0, pending: 0 },
  );
}

/**
 * Completed out of every occurrence of the window, leaving out today's (the last day's) pending ones:
 * the day is not over, so they are not misses yet.
 */
export function windowCompletion(days: readonly HabitStatsDay[]): Ratio {
  const totals = sumDays(days);
  const todayPending = days.at(-1)?.pending ?? 0;
  return ratio(
    totals.completed,
    totals.completed + totals.notCompleted + totals.pending - todayPending,
  );
}

export type ChartDay = StatusTotals & { day: DateOnly; total: number };

/** One bar per day of the window, oldest first. */
export function toChartDays(days: readonly HabitStatsDay[]): ChartDay[] {
  return days.map((day) => ({
    day: dateOnly(day.date),
    completed: day.completed,
    notCompleted: day.notCompleted,
    pending: day.pending,
    total: day.completed + day.notCompleted + day.pending,
  }));
}

/** The tallest bar (at least 1, so empty windows still scale). */
export function chartMax(days: readonly ChartDay[]): number {
  return Math.max(1, ...days.map((day) => day.total));
}

/** Share of `value` in `max`, as a CSS percentage. */
export function barHeight(value: number, max: number): string {
  return `${max > 0 ? (value / max) * 100 : 0}%`;
}

export type HabitRate = {
  habitId: number;
  title: string;
  /** Rounded completion rate, or `null` when there is nothing to count yet. */
  percent: number | null;
  streak: number;
};

function byRateDescending(a: HabitStatsItem, b: HabitStatsItem): number {
  if (a.completionRate === null) return b.completionRate === null ? 0 : 1;
  if (b.completionRate === null) return -1;
  return b.completionRate - a.completionRate;
}

/** One row per habit, best completion rate first and habits with no rate last (ties keep API order). */
export function habitRates(habits: readonly HabitStatsItem[]): HabitRate[] {
  return habits.toSorted(byRateDescending).map((habit) => ({
    habitId: habit.habitId,
    title: habit.habitTitle,
    percent: habit.completionRate === null ? null : Math.round(habit.completionRate * 100),
    streak: habit.currentStreak,
  }));
}
