import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { api, toast } = vi.hoisted(() => ({
  api: { POST: vi.fn(), PATCH: vi.fn(), GET: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/api/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser")>()),
  getBrowserApi: () => api,
}));
vi.mock("sonner", () => ({ toast }));

import type { Task } from "@/lib/tasks/hooks";
import { TaskFormDialog } from "./task-form-dialog";

const existing: Task = {
  id: 3,
  title: "Estudar",
  description: "Capítulo 3",
  dueDate: "2026-10-20T00:00:00",
  status: "Pending",
  createdOn: null,
  completedOn: null,
};

const ok = (data: unknown) => ({ data, response: { ok: true, status: 200 } });

function renderDialog(props: { task?: Task | null; defaultDueDate?: string } = {}) {
  const onOpenChange = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <TaskFormDialog open onOpenChange={onOpenChange} {...props} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

const save = () => userEvent.click(screen.getByRole("button", { name: "Salvar" }));

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.GET.mockResolvedValue(ok([]));
  toast.error.mockReset();
  toast.success.mockReset();
});

describe("TaskFormDialog creating", () => {
  it("shows validation errors in Portuguese and does not call the API", async () => {
    renderDialog();

    await save();

    expect(await screen.findByText("Informe o título da tarefa.")).toBeInTheDocument();
    expect(api.POST).not.toHaveBeenCalled();
  });

  it("creates a task with only a title, sending null for description and due date", async () => {
    api.POST.mockResolvedValue(ok({ ...existing, id: 9 }));
    const { onOpenChange } = renderDialog();

    expect(screen.getByRole("heading", { name: "Nova tarefa" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Título"), "  Comprar pão ");
    await save();

    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith("/api/tasks", {
        body: { title: "Comprar pão", description: null, dueDate: null },
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Tarefa criada.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sends the due date as an API date-time and starts with the default due date", async () => {
    api.POST.mockResolvedValue(ok(existing));
    renderDialog({ defaultDueDate: "2026-10-14" });

    expect(screen.getByLabelText("Prazo (opcional)")).toHaveValue("2026-10-14");
    await userEvent.type(screen.getByLabelText("Título"), "Ligar");
    await userEvent.type(screen.getByLabelText("Descrição (opcional)"), "para o médico");
    await save();

    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith("/api/tasks", {
        body: { title: "Ligar", description: "para o médico", dueDate: "2026-10-14T00:00:00" },
      }),
    );
  });

  it("shows the server message and keeps the dialog open when the API fails", async () => {
    api.POST.mockResolvedValue({
      error: { detail: "Limite de tarefas atingido." },
      response: { ok: false, status: 400 },
    });
    const { onOpenChange } = renderDialog();

    await userEvent.type(screen.getByLabelText("Título"), "Comprar pão");
    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent("Limite de tarefas atingido.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("puts a server field error under its field", async () => {
    api.POST.mockResolvedValue({
      error: { errors: { Title: ["Título já usado."] } },
      response: { ok: false, status: 400 },
    });
    renderDialog();

    await userEvent.type(screen.getByLabelText("Título"), "Comprar pão");
    await save();

    expect(await screen.findByText("Título já usado.")).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveAttribute("aria-invalid", "true");
  });

  it("closes without saving when cancelled", async () => {
    const { onOpenChange } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
    expect(api.POST).not.toHaveBeenCalled();
  });
});

describe("TaskFormDialog editing", () => {
  it("starts with the values of the task", () => {
    renderDialog({ task: existing });

    expect(screen.getByRole("heading", { name: "Editar tarefa" })).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Estudar");
    expect(screen.getByLabelText("Descrição (opcional)")).toHaveValue("Capítulo 3");
    expect(screen.getByLabelText("Prazo (opcional)")).toHaveValue("2026-10-20");
  });

  it("sends null for a blank description and a removed due date so the API clears them", async () => {
    api.PATCH.mockResolvedValue(ok({ ...existing, description: null, dueDate: null }));
    const { onOpenChange } = renderDialog({ task: existing });

    await userEvent.clear(screen.getByLabelText("Descrição (opcional)"));
    await userEvent.click(screen.getByRole("button", { name: "Remover prazo" }));
    await save();

    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith("/api/tasks/{id}", {
        params: { path: { id: 3 } },
        body: { title: "Estudar", description: null, dueDate: null },
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Tarefa atualizada.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not pre-fill the default due date when editing a task without one", () => {
    renderDialog({ task: { ...existing, dueDate: null }, defaultDueDate: "2026-10-14" });

    expect(screen.getByLabelText("Prazo (opcional)")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Remover prazo" })).not.toBeInTheDocument();
  });

  it("falls back to a generic message when the network fails", async () => {
    api.PATCH.mockRejectedValue(new TypeError("fetch failed"));
    renderDialog({ task: existing });

    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível conectar ao servidor",
    );
  });
});

describe("TaskFormDialog while saving", () => {
  it("ignores Escape until the API answers, so a failure is never hidden", async () => {
    let release: (value: unknown) => void = () => {};
    api.POST.mockReturnValue(new Promise((resolve) => (release = resolve)));
    const { onOpenChange } = renderDialog();

    await userEvent.type(screen.getByLabelText("Título"), "Comprar pão");
    await save();
    await screen.findByRole("button", { name: "Salvando…" });
    await userEvent.keyboard("{Escape}");

    expect(onOpenChange).not.toHaveBeenCalled();

    release(ok({ ...existing, id: 9 }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
