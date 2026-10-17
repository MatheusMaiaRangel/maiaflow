"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiData, getBrowserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import type { DateOnly } from "@/lib/dates";
import type { ServerSeed } from "@/lib/query-seed";

export type Occurrence = components["schemas"]["ReadHabitOccurrenceDTO"];
export type OccurrenceStatus = components["schemas"]["HabitOccurrenceStatus"];

/** Habit queries share the `habits` prefix, so one invalidation refreshes lists and calendars. */
export const HABITS_KEY = ["habits"] as const;
export const CALENDAR_KEY = [...HABITS_KEY, "calendar"] as const;
/** Prefix of the completion history (`useHabitStats`); a status change makes it stale too. */
export const STATS_KEY = [...HABITS_KEY, "stats"] as const;

export function calendarKey(start: DateOnly, end: DateOnly) {
  return [...CALENDAR_KEY, start, end] as const;
}

async function fetchOccurrences(start: DateOnly, end: DateOnly): Promise<Occurrence[]> {
  return apiData(
    await getBrowserApi().GET("/api/habits/calendar", { params: { query: { start, end } } }),
  );
}

/**
 * Occurrences from `start` to `end` (inclusive, at most 366 days). While a new range loads, the data of
 * the previous one stays in `data` (`isPlaceholderData` is true) so the screen does not flash empty.
 */
export function useOccurrences(start: DateOnly, end: DateOnly, seed?: ServerSeed<Occurrence[]>) {
  return useQuery({
    queryKey: calendarKey(start, end),
    queryFn: () => fetchOccurrences(start, end),
    initialData: seed?.data,
    initialDataUpdatedAt: seed?.fetchedAt,
    placeholderData: keepPreviousData,
  });
}

/** Replaces the status of one occurrence in every cached calendar range. */
function setStatusInCache(queryClient: QueryClient, id: number, status: OccurrenceStatus) {
  queryClient.setQueriesData<Occurrence[]>({ queryKey: CALENDAR_KEY }, (occurrences) =>
    occurrences?.map((occurrence) =>
      occurrence.id === id ? { ...occurrence, status } : occurrence,
    ),
  );
}

function findCachedStatus(queryClient: QueryClient, id: number): OccurrenceStatus | undefined {
  for (const [, occurrences] of queryClient.getQueriesData<Occurrence[]>({
    queryKey: CALENDAR_KEY,
  })) {
    const found = occurrences?.find((occurrence) => occurrence.id === id);
    if (found) return found.status;
  }
  return undefined;
}

/**
 * Changes the status in every cached range at once. If the API refuses, only that occurrence goes back to
 * its previous status (other pending changes stay). Once the last mutation in flight settles, refetches the
 * calendars and the completion history (the Today dashboards).
 */
export function useSetOccurrenceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...HABITS_KEY, "occurrence-status"],
    mutationFn: async ({ id, status }: { id: number; status: OccurrenceStatus }) => {
      if (id <= 0) throw new RangeError("Future occurrences cannot be updated.");
      return apiData(
        await getBrowserApi().PATCH("/api/habits/occurrences/{occurrenceId}/status", {
          params: { path: { occurrenceId: id } },
          body: { status },
        }),
      );
    },
    onMutate: async ({ id, status }) => {
      if (id <= 0) return { previousStatus: undefined };
      await queryClient.cancelQueries({ queryKey: CALENDAR_KEY });
      const previousStatus = findCachedStatus(queryClient, id);
      setStatusInCache(queryClient, id, status);
      return { previousStatus };
    },
    onError: (_error, { id }, context) => {
      if (context?.previousStatus) setStatusInCache(queryClient, id, context.previousStatus);
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: HABITS_KEY }) > 1) return;
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: CALENDAR_KEY }),
        queryClient.invalidateQueries({ queryKey: STATS_KEY }),
      ]);
    },
  });
}
