import "server-only";
import { ApiError, getAuthedApi, unwrap } from "@/lib/api/client";
import { gridRange } from "@/lib/calendar/grid";
import { dateOnly, startOfMonth, todayInBrasilia, type DateOnly } from "@/lib/dates";
import type { Occurrence } from "@/lib/habits/occurrences";
import { DASHBOARD_DAYS } from "@/lib/dashboard";
import type { HabitStats } from "@/lib/habits/stats";
import type { ServerSeed } from "@/lib/query-seed";
import type { Task } from "@/lib/tasks/hooks";
import { toDashboard, type Dashboard } from "@/lib/widgets/stored";

export type TodaySeed = {
  today: DateOnly;
  tasks: ServerSeed<Task[]>;
  /** Today's occurrences (the habits list). */
  occurrences: ServerSeed<Occurrence[]>;
  /** Occurrences of the grid of today's month (the calendar). */
  calendar: ServerSeed<Occurrence[]>;
  /** Missing when the stats call failed: the dashboards then load (or report the error) on the client. */
  stats?: ServerSeed<HabitStats>;
  /** Missing when the dashboard call failed: the client then loads it (or reports the error). */
  dashboard?: ServerSeed<Dashboard>;
};

type ApiResult<T> = Parameters<typeof unwrap<T>>[0];

/**
 * The dashboards are not essential to the page: a failed stats call leaves them to the client. A 401 still
 * goes through `unwrap`, which redirects to the login page.
 */
function optionalData<T>(result: ApiResult<T> | undefined, what: string): T | undefined {
  if (!result) return undefined;
  try {
    return unwrap(result);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.warn(`${what} for the Today screen failed with status ${error.status}`);
    return undefined;
  }
}

/**
 * Reads, on the server, everything the Today screen needs. "Today" is the Brasília date. The habits list
 * reuses today's slice of the month grid, so the screen needs one calendar call.
 */
export async function fetchTodaySeed(): Promise<TodaySeed> {
  const today = todayInBrasilia();
  const { start, end } = gridRange(startOfMonth(today));
  const api = await getAuthedApi();
  const [tasks, grid, stats, dashboard] = await Promise.all([
    api.GET("/api/tasks"),
    api.GET("/api/habits/calendar", { params: { query: { start, end } } }),
    api.GET("/api/habits/stats", { params: { query: { days: DASHBOARD_DAYS } } }).catch(() => {
      console.warn("Habit stats for the Today screen could not be reached");
      return undefined;
    }),
    api.GET("/api/dashboard").catch(() => {
      console.warn("Dashboard for the Today screen could not be reached");
      return undefined;
    }),
  ]);

  const fetchedAt = Date.now();
  const gridData = unwrap(grid);
  const statsData = optionalData(stats, "Habit stats");
  const dashboardData = optionalData(dashboard, "Dashboard");
  return {
    today,
    tasks: { data: unwrap(tasks), fetchedAt },
    occurrences: {
      data: gridData.filter((occurrence) => dateOnly(occurrence.date) === today),
      fetchedAt,
    },
    calendar: { data: gridData, fetchedAt },
    ...(statsData ? { stats: { data: statsData, fetchedAt } } : {}),
    ...(dashboardData ? { dashboard: { data: toDashboard(dashboardData), fetchedAt } } : {}),
  };
}
