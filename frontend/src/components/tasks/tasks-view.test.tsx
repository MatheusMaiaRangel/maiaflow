import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

import type { Task } from "@/lib/tasks/hooks";
import { TasksView } from "./tasks-view";

const TODAY = "2026-10-14";

const tasks: Task[] = [
  {
    id: 1,
    title: "Sem prazo",
    description: null,
    dueDate: null,
    status: "Pending",
    createdOn: null,
    completedOn: null,
  },
  {
    id: 2,
    title: "Atrasada demais",
    description: null,
    dueDate: "2026-10-01T00:00:00",
    status: "Pending",
    createdOn: null,
    completedOn: null,
  },
  {
    id: 3,
    title: "Feita",
    description: null,
    dueDate: null,
    status: "Completed",
    createdOn: null,
    completedOn: null,
  },
  {
    id: 4,
    title: "Deixei pra lá",
    description: null,
    dueDate: null,
    status: "NotCompleted",
    createdOn: null,
    completedOn: null,
  },
];

const ok = (data: unknown) => ({ data, response: { ok: true, status: 200 } });

function renderView(seedData: Task[] | null = tasks, fetchedAt: number = Date.now()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TasksView seed={seedData ? { data: seedData, fetchedAt } : undefined} today={TODAY} />
    </QueryClientProvider>,
  );
}

const rowTitles = () =>
  within(screen.getByRole("list", { name: "Lista de tarefas" }))
    .getAllByRole("listitem")
    .map((item) => within(item).getByRole("checkbox").getAttribute("aria-label"));

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.GET.mockResolvedValue(ok(tasks));
  toast.error.mockReset();
  toast.success.mockReset();
});

describe("TasksView list", () => {
  it("lists the tasks sorted: pending by due date, undated last, then the rest", () => {
    renderView();

    expect(rowTitles()).toEqual(["Atrasada demais", "Sem prazo", "Deixei pra lá", "Feita"]);
  });

  it("shows the counts on the filter tabs", () => {
    renderView();

    expect(screen.getByRole("tab", { name: "Todas (4)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pendentes (2)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Concluídas (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Não concluídas (1)" })).toBeInTheDocument();
  });

  it("filters by status", async () => {
    renderView();

    await userEvent.click(screen.getByRole("tab", { name: /Concluídas/ }));
    expect(rowTitles()).toEqual(["Feita"]);

    await userEvent.click(screen.getByRole("tab", { name: /Não concluídas/ }));
    expect(rowTitles()).toEqual(["Deixei pra lá"]);
  });

  it("explains an empty filter", async () => {
    renderView([tasks[0]!]);

    await userEvent.click(screen.getByRole("tab", { name: /Concluídas/ }));

    expect(screen.getByText("Nenhuma tarefa concluída")).toBeInTheDocument();
  });

  it("invites the user to create the first task when there are none", () => {
    renderView([]);

    expect(screen.getByText("Nenhuma tarefa ainda")).toBeInTheDocument();
  });

  it("marks a late pending task using today from the server", () => {
    renderView();

    expect(screen.getByText(/Atrasada ·/)).toBeInTheDocument();
  });
});

describe("TasksView create and edit", () => {
  it("creates a task from the header button and shows it in the list", async () => {
    const created: Task = {
      id: 10,
      title: "Nova",
      description: null,
      dueDate: null,
      status: "Pending",
      createdOn: null,
      completedOn: null,
    };
    api.POST.mockResolvedValue(ok(created));
    api.GET.mockResolvedValue(ok([...tasks, created]));
    renderView();

    await userEvent.click(screen.getByRole("button", { name: "Nova tarefa" }));
    await userEvent.type(await screen.findByLabelText("Título"), "Nova");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(rowTitles()).toContain("Nova"));
  });

  it("edits a task from its menu", async () => {
    api.PATCH.mockResolvedValue(ok({ ...tasks[0], title: "Renomeada" }));
    renderView();

    await userEvent.click(screen.getByRole("button", { name: "Ações da tarefa Sem prazo" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Editar/ }));
    const title = await screen.findByLabelText("Título");
    expect(title).toHaveValue("Sem prazo");
    await userEvent.clear(title);
    await userEvent.type(title, "Renomeada");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith("/api/tasks/{id}", {
        params: { path: { id: 1 } },
        body: { title: "Renomeada", description: null, dueDate: null },
      }),
    );
  });
});

describe("TasksView delete", () => {
  const askToDelete = async (name: string) => {
    await userEvent.click(screen.getByRole("button", { name: `Ações da tarefa ${name}` }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Excluir/ }));
  };

  it("asks for confirmation and removes the task right away", async () => {
    api.DELETE.mockResolvedValue({ response: { ok: true, status: 204 } });
    api.GET.mockResolvedValue(ok(tasks.filter((task) => task.id !== 1)));
    renderView();

    await askToDelete("Sem prazo");
    expect(await screen.findByText(/"Sem prazo" será excluída/)).toBeInTheDocument();
    expect(api.DELETE).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(rowTitles()).not.toContain("Sem prazo"));
    expect(api.DELETE).toHaveBeenCalledWith("/api/tasks/{id}", { params: { path: { id: 1 } } });
  });

  it("keeps the task when the confirmation is cancelled", async () => {
    renderView();

    await askToDelete("Sem prazo");
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByText(/será excluída/)).not.toBeInTheDocument());
    expect(api.DELETE).not.toHaveBeenCalled();
    expect(rowTitles()).toContain("Sem prazo");
  });
});

describe("TasksView loading and errors", () => {
  it("shows a skeleton while the list loads in the browser", async () => {
    api.GET.mockReturnValue(new Promise(() => {}));
    renderView(null);

    expect(screen.getByRole("status", { name: "Carregando tarefas" })).toBeInTheDocument();
  });

  it("shows the tasks once they load", async () => {
    renderView(null);

    expect(await screen.findByRole("list", { name: "Lista de tarefas" })).toBeInTheDocument();
    expect(rowTitles()).toHaveLength(4);
  });

  it("shows an error with a retry button when the list cannot be loaded", async () => {
    api.GET.mockResolvedValueOnce({ error: {}, response: { ok: false, status: 500 } });
    renderView(null);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as tarefas",
    );
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByRole("list", { name: "Lista de tarefas" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps showing the tasks when a background refresh fails", async () => {
    api.GET.mockResolvedValue({ error: {}, response: { ok: false, status: 500 } });
    renderView(tasks, 0);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as tarefas",
    );
    expect(rowTitles()).toHaveLength(4);
  });
});
