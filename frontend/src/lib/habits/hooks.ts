"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiData, apiDone, getBrowserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import type { ServerSeed } from "@/lib/query-seed";
import { HABITS_KEY } from "./occurrences";

export type Habit = components["schemas"]["ReadHabitDTO"];
export type CreateHabitInput = components["schemas"]["CreateHabitDTO"];
export type UpdateHabitInput = components["schemas"]["UpdateHabitDetailsDTO"];
export type ChangeRecurrenceInput = components["schemas"]["ChangeRecurrenceDTO"];

export const HABITS_LIST_KEY = [...HABITS_KEY, "list"] as const;

async function fetchHabits(): Promise<Habit[]> {
  return apiData(await getBrowserApi().GET("/api/habits"));
}

/** All of the user's habits. Pass the server-fetched list as `seed` to skip the first request. */
export function useHabits(seed?: ServerSeed<Habit[]>) {
  return useQuery({
    queryKey: HABITS_LIST_KEY,
    queryFn: fetchHabits,
    initialData: seed?.data,
    initialDataUpdatedAt: seed?.fetchedAt,
  });
}

/** Shares the `habits` prefix with the calendars, so one invalidation refreshes everything. */
function useRefreshHabits() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: HABITS_KEY });
}

function useReplaceHabitInList() {
  const queryClient = useQueryClient();
  return (updated: Habit) =>
    queryClient.setQueryData<Habit[]>(HABITS_LIST_KEY, (habits) =>
      habits?.map((habit) => (habit.id === updated.id ? updated : habit)),
    );
}

export function useCreateHabit() {
  const queryClient = useQueryClient();
  const refresh = useRefreshHabits();
  return useMutation({
    mutationFn: async (input: CreateHabitInput) =>
      apiData(await getBrowserApi().POST("/api/habits", { body: input })),
    onSuccess: (created) => {
      queryClient.setQueryData<Habit[]>(HABITS_LIST_KEY, (habits) =>
        habits ? [...habits, created] : habits,
      );
    },
    onSettled: refresh,
  });
}

/** PATCH semantics: leave a field out to keep it, send `null` to clear the description. */
export function useUpdateHabit() {
  const refresh = useRefreshHabits();
  const replaceInList = useReplaceHabitInList();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateHabitInput & { id: number }) =>
      apiData(await getBrowserApi().PATCH("/api/habits/{id}", { params: { path: { id } }, body })),
    onSuccess: replaceInList,
    onSettled: refresh,
  });
}

export function useChangeRecurrence() {
  const refresh = useRefreshHabits();
  const replaceInList = useReplaceHabitInList();
  return useMutation({
    mutationFn: async ({ id, ...body }: ChangeRecurrenceInput & { id: number }) =>
      apiData(
        await getBrowserApi().PATCH("/api/habits/{id}/recurrence", {
          params: { path: { id } },
          body,
        }),
      ),
    onSuccess: replaceInList,
    onSettled: refresh,
  });
}

/** Also deletes the habit's rules and occurrences on the server. */
export function useDeleteHabit() {
  const queryClient = useQueryClient();
  const refresh = useRefreshHabits();
  return useMutation({
    mutationFn: async (id: number) =>
      apiDone(await getBrowserApi().DELETE("/api/habits/{id}", { params: { path: { id } } })),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<Habit[]>(HABITS_LIST_KEY, (habits) =>
        habits?.filter((habit) => habit.id !== id),
      );
    },
    onSettled: refresh,
  });
}
