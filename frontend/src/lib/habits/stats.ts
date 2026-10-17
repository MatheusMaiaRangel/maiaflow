"use client";

import { useQuery } from "@tanstack/react-query";
import { apiData, getBrowserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import type { DateOnly } from "@/lib/dates";
import type { ServerSeed } from "@/lib/query-seed";
import { STATS_KEY } from "./occurrences";

export type HabitStats = components["schemas"]["ReadHabitStatsDTO"];
export type HabitStatsDay = components["schemas"]["ReadHabitStatsDayDTO"];
export type HabitStatsItem = components["schemas"]["ReadHabitStatsItemDTO"];

/**
 * Under the `habits` prefix, so creating or deleting a habit refreshes it too. Keyed by `today` as well: after
 * midnight the window moves, and the new day's server seed must not be ignored in favor of yesterday's cache.
 */
export function statsKey(days: number, today: DateOnly) {
  return [...STATS_KEY, days, today] as const;
}

async function fetchHabitStats(days: number): Promise<HabitStats> {
  return apiData(await getBrowserApi().GET("/api/habits/stats", { params: { query: { days } } }));
}

/** Completion history of the last `days` days, ending `today`. Pass the server's answer as `seed`. */
export function useHabitStats(days: number, today: DateOnly, seed?: ServerSeed<HabitStats>) {
  return useQuery({
    queryKey: statsKey(days, today),
    queryFn: () => fetchHabitStats(days),
    initialData: seed?.data,
    initialDataUpdatedAt: seed?.fetchedAt,
  });
}
