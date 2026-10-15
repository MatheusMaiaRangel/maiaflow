"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiData, apiDone, errorMessage, getBrowserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import type { ServerSeed } from "@/lib/query-seed";

export type Task = components["schemas"]["ReadTaskDTO"];
export type TaskStatus = components["schemas"]["TaskItemStatus"];
export type CreateTaskInput = components["schemas"]["CreateTaskDTO"];
export type UpdateTaskInput = components["schemas"]["UpdateTaskDTO"];

export const TASKS_KEY = ["tasks"] as const;

/**
 * Refetches the list once the last task mutation in flight has settled. Refetching earlier could bring
 * back server state that does not have the other pending changes yet and make their rows flicker.
 */
function refreshWhenIdle(queryClient: QueryClient): Promise<void> | void {
  if (queryClient.isMutating({ mutationKey: TASKS_KEY }) > 1) return;
  return queryClient.invalidateQueries({ queryKey: TASKS_KEY });
}

async function fetchTasks(): Promise<Task[]> {
  return apiData(await getBrowserApi().GET("/api/tasks"));
}

/** All of the user's tasks. Pass the server-fetched list as `seed` to skip the first request. */
export function useTasks(seed?: ServerSeed<Task[]>) {
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: fetchTasks,
    initialData: seed?.data,
    initialDataUpdatedAt: seed?.fetchedAt,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...TASKS_KEY, "create"],
    mutationFn: async (input: CreateTaskInput) =>
      apiData(await getBrowserApi().POST("/api/tasks", { body: input })),
    onSuccess: (created) => {
      queryClient.setQueryData<Task[]>(TASKS_KEY, (tasks) => [...(tasks ?? []), created]);
    },
    onSettled: () => refreshWhenIdle(queryClient),
  });
}

/** PATCH semantics: leave a field out to keep it, send `null` to clear description or due date. */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...TASKS_KEY, "update"],
    mutationFn: async ({ id, ...body }: UpdateTaskInput & { id: number }) =>
      apiData(await getBrowserApi().PATCH("/api/tasks/{id}", { params: { path: { id } }, body })),
    onSuccess: (updated) => {
      queryClient.setQueryData<Task[]>(TASKS_KEY, (tasks) =>
        tasks?.map((task) => (task.id === updated.id ? updated : task)),
      );
    },
    onSettled: () => refreshWhenIdle(queryClient),
  });
}

/**
 * Changes the status right away; if the API refuses it puts back only that task's previous status (other
 * pending changes stay) and shows an error toast.
 */
export function useSetTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...TASKS_KEY, "status"],
    mutationFn: async ({ id, status }: { id: number; status: TaskStatus }) =>
      apiData(
        await getBrowserApi().PATCH("/api/tasks/{id}/status", {
          params: { path: { id } },
          body: { status },
        }),
      ),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      const previousStatus = queryClient
        .getQueryData<Task[]>(TASKS_KEY)
        ?.find((task) => task.id === id)?.status;
      queryClient.setQueryData<Task[]>(TASKS_KEY, (tasks) =>
        tasks?.map((task) => (task.id === id ? { ...task, status } : task)),
      );
      return { previousStatus };
    },
    onError: (error, { id }, context) => {
      const previousStatus = context?.previousStatus;
      if (previousStatus) {
        queryClient.setQueryData<Task[]>(TASKS_KEY, (tasks) =>
          tasks?.map((task) => (task.id === id ? { ...task, status: previousStatus } : task)),
        );
      }
      toast.error(errorMessage(error, "Não foi possível atualizar a tarefa."));
    },
    onSettled: () => refreshWhenIdle(queryClient),
  });
}

/** Removes the task right away; if the API refuses it puts it back and shows an error toast. */
export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...TASKS_KEY, "delete"],
    mutationFn: async (id: number) =>
      apiDone(await getBrowserApi().DELETE("/api/tasks/{id}", { params: { path: { id } } })),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      const index =
        queryClient.getQueryData<Task[]>(TASKS_KEY)?.findIndex((task) => task.id === id) ?? -1;
      const removed = index >= 0 ? queryClient.getQueryData<Task[]>(TASKS_KEY)?.[index] : undefined;
      queryClient.setQueryData<Task[]>(TASKS_KEY, (tasks) =>
        tasks?.filter((task) => task.id !== id),
      );
      return { removed, index };
    },
    onError: (error, _id, context) => {
      const removed = context?.removed;
      if (removed) {
        queryClient.setQueryData<Task[]>(TASKS_KEY, (tasks) =>
          tasks?.some((task) => task.id === removed.id)
            ? tasks
            : (tasks ?? []).toSpliced(context.index, 0, removed),
        );
      }
      toast.error(errorMessage(error, "Não foi possível excluir a tarefa."));
    },
    onSuccess: () => toast.success("Tarefa excluída."),
    onSettled: () => refreshWhenIdle(queryClient),
  });
}
