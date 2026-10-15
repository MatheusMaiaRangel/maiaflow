import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Occurrence } from "@/lib/habits/occurrences";
import type { Task } from "@/lib/tasks/hooks";
import { TodayView } from "./today-view";

const getBrowserApi = vi.fn();
vi.mock("@/lib/api/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser")>()),
  getBrowserApi: () => getBrowserApi(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const TODAY = "2026-10-14";

function task(id: number, dueDate: string | null, status: Task["status"] = "Pending"): Task {
  return { id, title: `Tarefa ${id}`, description: null, dueDate, status };
}

function occurrence(id: number, status: Occurrence["status"] = "Pending"): Occurrence {
  return { id, habitId: id, habitTitle: `Hábito ${id}`, date: `${TODAY}T00:00:00`, status };
}

function renderView(tasks: Task[], occurrences: Occurrence[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const fetchedAt = Date.now();
  return render(
    <TodayView
      today={TODAY}
      tasksSeed={{ data: tasks, fetchedAt }}
      occurrencesSeed={{ data: occurrences, fetchedAt }}
    />,
    { wrapper },
  );
}

beforeEach(() => getBrowserApi.mockReset());

describe("TodayView", () => {
  it("shows the server's date in Portuguese", () => {
    renderView([], []);

    expect(screen.getByText("Quarta-feira, 14 de outubro")).toBeInTheDocument();
  });

  it("shows friendly empty states when there is nothing for today", () => {
    renderView([task(1, null)], []);

    expect(screen.getByText("Nenhum hábito para hoje")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma tarefa para hoje")).toBeInTheDocument();
  });

  it("lists today's habits with progress", () => {
    renderView([], [occurrence(1, "Completed"), occurrence(2)]);

    const section = screen.getByRole("region", { name: "Hábitos de hoje" });
    expect(within(section).getByText("Hábito 1")).toBeInTheDocument();
    expect(within(section).getByText("Hábito 2")).toBeInTheDocument();
    expect(within(section).getByText("1 de 2 feitos")).toBeInTheDocument();
  });

  it("separates overdue tasks from tasks due today", () => {
    renderView(
      [
        task(1, "2026-10-12T00:00:00"),
        task(2, "2026-10-14T00:00:00"),
        task(3, "2026-10-20T00:00:00"),
      ],
      [],
    );

    const section = screen.getByRole("region", { name: "Tarefas de hoje" });
    expect(within(section).getByText("Atrasadas")).toBeInTheDocument();
    expect(within(section).getByText("Tarefa 1")).toBeInTheDocument();
    expect(within(section).getByText("Tarefa 2")).toBeInTheDocument();
    expect(within(section).queryByText("Tarefa 3")).not.toBeInTheDocument();
    expect(within(section).getByText("0 de 2 feitas")).toBeInTheDocument();
  });

  it("marks a habit as done through the API", async () => {
    const patch = vi.fn().mockResolvedValue({
      data: occurrence(1, "Completed"),
      response: new Response(null, { status: 200 }),
    });
    getBrowserApi.mockReturnValue({ PATCH: patch, GET: vi.fn() });
    renderView([], [occurrence(1)]);

    await userEvent.click(screen.getByRole("button", { name: "Feito" }));

    expect(patch).toHaveBeenCalledWith("/api/habits/occurrences/{occurrenceId}/status", {
      params: { path: { occurrenceId: 1 } },
      body: { status: "Completed" },
    });
  });

  it("completes a task through the API", async () => {
    const patch = vi.fn().mockResolvedValue({
      data: task(2, "2026-10-14T00:00:00", "Completed"),
      response: new Response(null, { status: 200 }),
    });
    getBrowserApi.mockReturnValue({ PATCH: patch, GET: vi.fn() });
    renderView([task(2, "2026-10-14T00:00:00")], []);

    await userEvent.click(screen.getByRole("checkbox", { name: "Tarefa 2" }));

    expect(patch).toHaveBeenCalledWith("/api/tasks/{id}/status", {
      params: { path: { id: 2 } },
      body: { status: "Completed" },
    });
  });
});
