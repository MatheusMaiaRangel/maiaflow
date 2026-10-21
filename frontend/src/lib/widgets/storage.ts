"use client";

/**
 * The user's dashboard as stored by the API (D28), so it follows them to any device. Saves are optimistic
 * and run one after the other: each one sends the revision the previous one got back, and a 409 means
 * another device saved first. After a failed save the saves still queued behind it are dropped: they were
 * made on top of a screen that is no longer what the server has.
 */
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { apiData, apiDone, ClientApiError, errorMessage, getBrowserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import type { ServerSeed } from "@/lib/query-seed";
import type { DashboardConfig } from "./config";
import { DEFAULT_DASHBOARD } from "./default-dashboard";
import { toDashboard, type Dashboard } from "./stored";

export type { Dashboard } from "./stored";

export const DASHBOARD_KEY = ["dashboard"] as const;
/** Saves and resets run in this order, never side by side. */
const SAVE_SCOPE = { id: "dashboard" };

export const CONFLICT_MESSAGE =
  "O painel foi alterado em outro aparelho. Mostramos a versão mais nova.";
const SAVE_ERROR_MESSAGE = "Não foi possível salvar o painel. Tente novamente.";
const RESET_ERROR_MESSAGE = "Não foi possível restaurar o painel padrão. Tente novamente.";

async function fetchDashboard(): Promise<Dashboard> {
  return toDashboard(apiData(await getBrowserApi().GET("/api/dashboard")));
}

export function useDashboard(seed?: ServerSeed<Dashboard>) {
  // A refetch landing while a save is in flight would bring back the old revision and screen.
  const isSaving = useIsMutating({ mutationKey: DASHBOARD_KEY }) > 0;
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: fetchDashboard,
    initialData: seed?.data,
    initialDataUpdatedAt: seed?.fetchedAt,
    enabled: !isSaving,
    refetchOnWindowFocus: false,
  });
}

/** Counts failures per query client; a save queued before the last failure is dropped. */
const failures = new WeakMap<QueryClient, number>();

function failureCount(queryClient: QueryClient): number {
  return failures.get(queryClient) ?? 0;
}

/** A save that was queued behind a failed one. It never reaches the API and shows no message. */
class DroppedSaveError extends Error {}

type SaveVariables = { config: DashboardConfig; failuresWhenQueued: number };

function isLastSave(queryClient: QueryClient): boolean {
  return queryClient.isMutating({ mutationKey: DASHBOARD_KEY }) <= 1;
}

async function showLocally(queryClient: QueryClient, config: DashboardConfig, isDefault: boolean) {
  await queryClient.cancelQueries({ queryKey: DASHBOARD_KEY });
  queryClient.setQueryData<Dashboard>(DASHBOARD_KEY, (current) => ({
    revision: current?.revision ?? 0,
    config,
    isDefault,
  }));
}

/** Server state wins after a failure; the toast says why the screen changed. */
function recover(queryClient: QueryClient, error: unknown, fallback: string) {
  if (error instanceof DroppedSaveError) return;
  failures.set(queryClient, failureCount(queryClient) + 1);
  const conflict = error instanceof ClientApiError && error.status === 409;
  toast.error(conflict ? CONFLICT_MESSAGE : errorMessage(error, fallback));
  return queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
}

/** Saves the whole dashboard; the screen shows it at once. */
export function useSaveDashboard() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: [...DASHBOARD_KEY, "save"],
    scope: SAVE_SCOPE,
    mutationFn: async ({ config, failuresWhenQueued }: SaveVariables) => {
      if (failuresWhenQueued !== failureCount(queryClient)) throw new DroppedSaveError();
      // Read when the save runs, not when it was queued: the previous save may have moved it on.
      const revision = queryClient.getQueryData<Dashboard>(DASHBOARD_KEY)?.revision ?? 0;
      const body = { revision, config } as components["schemas"]["SaveDashboardDTO"];
      return toDashboard(apiData(await getBrowserApi().PUT("/api/dashboard", { body })));
    },
    onMutate: ({ config }) => showLocally(queryClient, config, false),
    onSuccess: (saved) => {
      // Later saves already show their own changes; only the revision moves on until the last one.
      queryClient.setQueryData<Dashboard>(DASHBOARD_KEY, (current) =>
        isLastSave(queryClient) || !current ? saved : { ...current, revision: saved.revision },
      );
    },
    onError: (error) => recover(queryClient, error, SAVE_ERROR_MESSAGE),
  });
  return {
    isPending: mutation.isPending,
    mutate: (config: DashboardConfig) =>
      mutation.mutate({ config, failuresWhenQueued: failureCount(queryClient) }),
  };
}

/** "Restaurar padrão": forgets the stored dashboard; the default set shows again. */
export function useResetDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...DASHBOARD_KEY, "reset"],
    scope: SAVE_SCOPE,
    mutationFn: async () => apiDone(await getBrowserApi().DELETE("/api/dashboard")),
    onMutate: () => showLocally(queryClient, DEFAULT_DASHBOARD, true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY }),
    onError: (error) => recover(queryClient, error, RESET_ERROR_MESSAGE),
  });
}
