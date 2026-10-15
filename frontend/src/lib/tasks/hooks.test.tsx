import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { api, toast } = vi.hoisted(() => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/api/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser")>()),
  getBrowserApi: () => api,
}));
vi.mock("sonner", () => ({ toast }));

import {
  TASKS_KEY,
  useCreateTask,
  useDeleteTask,
  useSetTaskStatus,
  useTasks,
  useUpdateTask,
  type Task,
} from "./hooks";

const ok = (data: unknown) => ({ data, response: { ok: true, status: 200 } });
const fail = (status: number, error: unknown) => ({ error, response: { ok: false, status } });

const first: Task = {
  id: 1,
  title: "Primeira",
  description: null,
  dueDate: null,
  status: "Pending",
};
const second: Task = {
  id: 2,
  title: "Segunda",
  description: null,
  dueDate: null,
  status: "Pending",
};

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const cached = () => queryClient.getQueryData<Task[]>(TASKS_KEY);

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  Object.values(api).forEach((fn) => fn.mockReset());
  toast.error.mockReset();
  toast.success.mockReset();
});

describe("useTasks", () => {
  it("uses the server seed without requesting the list again", () => {
    const { result } = renderHook(() => useTasks({ data: [first], fetchedAt: Date.now() }), {
      wrapper,
    });

    expect(result.current.data).toEqual([first]);
    expect(api.GET).not.toHaveBeenCalled();
  });

  it("loads the list from the API when there is no seed", async () => {
    api.GET.mockResolvedValue(ok([first, second]));

    const { result } = renderHook(() => useTasks(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([first, second]));
  });
});

describe("useCreateTask and useUpdateTask", () => {
  it("adds the created task to the cached list", async () => {
    queryClient.setQueryData(TASKS_KEY, [first]);
    api.POST.mockResolvedValue(ok(second));
    api.GET.mockResolvedValue(ok([first, second]));
    const { result } = renderHook(() => useCreateTask(), { wrapper });

    await act(() => result.current.mutateAsync({ title: "Segunda" }));

    expect(api.POST).toHaveBeenCalledWith("/api/tasks", { body: { title: "Segunda" } });
    expect(cached()).toEqual([first, second]);
  });

  it("replaces the updated task in the cached list and sends nulls to clear fields", async () => {
    const updated = { ...first, title: "Nova" };
    queryClient.setQueryData(TASKS_KEY, [first, second]);
    api.PATCH.mockResolvedValue(ok(updated));
    api.GET.mockResolvedValue(ok([updated, second]));
    const { result } = renderHook(() => useUpdateTask(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ id: 1, title: "Nova", description: null, dueDate: null }),
    );

    expect(api.PATCH).toHaveBeenCalledWith("/api/tasks/{id}", {
      params: { path: { id: 1 } },
      body: { title: "Nova", description: null, dueDate: null },
    });
    expect(cached()).toEqual([updated, second]);
  });
});

describe("useSetTaskStatus", () => {
  it("changes the status in the cache before the API answers", async () => {
    queryClient.setQueryData(TASKS_KEY, [first]);
    let release: (value: unknown) => void = () => {};
    api.PATCH.mockReturnValue(new Promise((resolve) => (release = resolve)));
    api.GET.mockResolvedValue(ok([{ ...first, status: "Completed" }]));
    const { result } = renderHook(() => useSetTaskStatus(), { wrapper });

    act(() => result.current.mutate({ id: 1, status: "Completed" }));

    await waitFor(() => expect(cached()?.[0]?.status).toBe("Completed"));
    release(ok({ ...first, status: "Completed" }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("rolls back and shows the server message when the API refuses", async () => {
    queryClient.setQueryData(TASKS_KEY, [first]);
    api.PATCH.mockResolvedValue(fail(404, { detail: "Tarefa não encontrada." }));
    api.GET.mockResolvedValue(ok([first]));
    const { result } = renderHook(() => useSetTaskStatus(), { wrapper });

    act(() => result.current.mutate({ id: 1, status: "Completed" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Tarefa não encontrada."));
    expect(cached()).toEqual([first]);
  });
});

describe("concurrent status changes", () => {
  it("rolls back only the task whose request failed and refetches once, after the last one", async () => {
    queryClient.setQueryData(TASKS_KEY, [first, second]);
    let rejectFirst: (value: unknown) => void = () => {};
    let resolveSecond: (value: unknown) => void = () => {};
    api.PATCH.mockReturnValueOnce(
      new Promise((resolve) => (rejectFirst = resolve)),
    ).mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)));
    api.GET.mockResolvedValue(ok([first, { ...second, status: "Completed" }]));
    // An active observer, so invalidation really refetches.
    renderHook(() => useTasks(), { wrapper });
    const hook1 = renderHook(() => useSetTaskStatus(), { wrapper });
    const hook2 = renderHook(() => useSetTaskStatus(), { wrapper });

    act(() => hook1.result.current.mutate({ id: 1, status: "Completed" }));
    await waitFor(() => expect(cached()?.[0]?.status).toBe("Completed"));
    act(() => hook2.result.current.mutate({ id: 2, status: "Completed" }));
    await waitFor(() => expect(cached()?.[1]?.status).toBe("Completed"));

    rejectFirst(fail(500, { detail: "Erro." }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());

    expect(cached()?.map((task) => task.status)).toEqual(["Pending", "Completed"]);
    expect(api.GET).not.toHaveBeenCalled();

    resolveSecond(ok({ ...second, status: "Completed" }));
    await waitFor(() => expect(api.GET).toHaveBeenCalledOnce());
  });
});

describe("useDeleteTask", () => {
  it("removes the task right away and confirms with a toast", async () => {
    queryClient.setQueryData(TASKS_KEY, [first, second]);
    api.DELETE.mockResolvedValue({ response: { ok: true, status: 204 } });
    api.GET.mockResolvedValue(ok([second]));
    const { result } = renderHook(() => useDeleteTask(), { wrapper });

    await act(() => result.current.mutateAsync(1));

    expect(cached()).toEqual([second]);
    expect(toast.success).toHaveBeenCalledWith("Tarefa excluída.");
  });

  it("puts the task back and shows an error toast when the API refuses", async () => {
    queryClient.setQueryData(TASKS_KEY, [first, second]);
    api.DELETE.mockResolvedValue(fail(500, {}));
    api.GET.mockResolvedValue(ok([first, second]));
    const { result } = renderHook(() => useDeleteTask(), { wrapper });

    act(() => result.current.mutate(1));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível excluir a tarefa."),
    );
    expect(cached()).toEqual([first, second]);
  });
});
