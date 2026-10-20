import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { api } = vi.hoisted(() => ({ api: { PATCH: vi.fn() } }));

vi.mock("@/lib/api/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser")>()),
  getBrowserApi: () => api,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import type { Task } from "@/lib/tasks/hooks";
import { TaskRow, type TaskRowProps } from "./task-row";

const TODAY = "2026-10-14";

const baseTask: Task = {
  id: 7,
  title: "Pagar conta de luz",
  description: null,
  dueDate: null,
  status: "Pending",
  createdOn: null,
  completedOn: null,
};

function renderRow(props: Partial<Omit<TaskRowProps, "task">> & { task?: Partial<Task> } = {}) {
  const { task, ...rest } = props;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ul>
        <TaskRow task={{ ...baseTask, ...task }} today={TODAY} {...rest} />
      </ul>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.PATCH.mockReset().mockResolvedValue({
    data: { ...baseTask, status: "Completed", createdOn: null, completedOn: null },
    response: { ok: true, status: 200 },
  });
});

describe("TaskRow content", () => {
  it("shows the title and description", () => {
    renderRow({ task: { description: "Vence na sexta" } });

    expect(screen.getByText("Pagar conta de luz")).toBeInTheDocument();
    expect(screen.getByText("Vence na sexta")).toBeInTheDocument();
  });

  it("flags a pending task due before today as late", () => {
    renderRow({ task: { dueDate: "2026-10-10T00:00:00" } });

    expect(screen.getByText(/Atrasada/)).toHaveTextContent("10/10/2026");
  });

  it("shows 'Hoje' for a task due today", () => {
    renderRow({ task: { dueDate: "2026-10-14T00:00:00" } });

    expect(screen.getByText("Hoje")).toBeInTheDocument();
  });

  it("shows just the date for a task due in the future", () => {
    renderRow({ task: { dueDate: "2026-10-20T00:00:00" } });
    expect(screen.getByText("20/10/2026")).toBeInTheDocument();
  });

  it("does not flag a completed task as late and strikes the title through", () => {
    renderRow({
      task: {
        dueDate: "2026-10-01T00:00:00",
        status: "Completed",
        createdOn: null,
        completedOn: null,
      },
    });

    expect(screen.queryByText(/Atrasada/)).not.toBeInTheDocument();
    expect(screen.getByText("01/10/2026")).toBeInTheDocument();
    expect(screen.getByText("Pagar conta de luz")).toHaveClass("line-through");
    expect(screen.getByRole("checkbox", { name: "Pagar conta de luz" })).toBeChecked();
  });

  it("shows the status of a task marked as not completed", () => {
    renderRow({ task: { status: "NotCompleted", createdOn: null, completedOn: null } });

    expect(screen.getByText("Não concluída")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Pagar conta de luz" })).not.toBeChecked();
  });
});

describe("TaskRow checkbox", () => {
  it("completes a pending task", async () => {
    renderRow();

    await userEvent.click(screen.getByRole("checkbox", { name: "Pagar conta de luz" }));

    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith("/api/tasks/{id}/status", {
        params: { path: { id: 7 } },
        body: { status: "Completed" },
      }),
    );
  });

  it("sends a completed task back to pending", async () => {
    renderRow({ task: { status: "Completed", createdOn: null, completedOn: null } });

    await userEvent.click(screen.getByRole("checkbox", { name: "Pagar conta de luz" }));

    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith("/api/tasks/{id}/status", {
        params: { path: { id: 7 } },
        body: { status: "Pending" },
      }),
    );
  });
});

describe("TaskRow actions menu", () => {
  const openMenu = () =>
    userEvent.click(screen.getByRole("button", { name: "Ações da tarefa Pagar conta de luz" }));

  it("hides the menu when showActions is false", () => {
    renderRow({ showActions: false, onEdit: vi.fn(), onDelete: vi.fn() });

    expect(screen.queryByRole("button", { name: /Ações da tarefa/ })).not.toBeInTheDocument();
  });

  it("calls onEdit and onDelete with the task", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderRow({ onEdit, onDelete });

    await openMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: /Editar/ }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));

    await openMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: /Excluir/ }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });

  it("only offers the actions it was given a handler for", async () => {
    renderRow();

    await openMenu();

    expect(await screen.findByRole("menuitem", { name: /não concluída/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Excluir/ })).not.toBeInTheDocument();
  });

  it("marks the task as not completed", async () => {
    renderRow();

    await openMenu();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Marcar como não concluída/ }),
    );

    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith("/api/tasks/{id}/status", {
        params: { path: { id: 7 } },
        body: { status: "NotCompleted" },
      }),
    );
  });

  it("offers to reopen a task that was marked as not completed", async () => {
    renderRow({ task: { status: "NotCompleted", createdOn: null, completedOn: null } });

    await openMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: /Marcar como pendente/ }));

    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith("/api/tasks/{id}/status", {
        params: { path: { id: 7 } },
        body: { status: "Pending" },
      }),
    );
  });
});
