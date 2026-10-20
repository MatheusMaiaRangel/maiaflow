import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Occurrence } from "@/lib/habits/occurrences";
import type { HabitStats, HabitStatsItem } from "@/lib/habits/stats";
import type { ServerSeed } from "@/lib/query-seed";
import type { Task } from "@/lib/tasks/hooks";
import { Dashboards } from "./dashboards";

const get = vi.fn();
vi.mock("@/lib/api/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser")>()),
  getBrowserApi: () => ({ GET: get }),
}));

const TODAY = "2026-10-14";

function occurrence(id: number, status: Occurrence["status"] = "Pending"): Occurrence {
  return { id, habitId: id, habitTitle: `Hábito ${id}`, date: `${TODAY}T00:00:00`, status };
}

function task(id: number, dueDate: string | null, status: Task["status"] = "Pending"): Task {
  return {
    id,
    title: `Tarefa ${id}`,
    description: null,
    dueDate,
    status,
    createdOn: null,
    completedOn: null,
  };
}

function item(
  habitId: number,
  habitTitle: string,
  completionRate: number | null,
  currentStreak: number,
): HabitStatsItem {
  return {
    habitId,
    habitTitle,
    scheduled: 30,
    completed: 20,
    notCompleted: 9,
    pending: 1,
    completionRate,
    currentStreak,
    bestStreak: currentStreak,
  };
}

const STATS: HabitStats = {
  start: "2026-10-12T00:00:00",
  end: `${TODAY}T00:00:00`,
  days: [
    { date: "2026-10-12T00:00:00", completed: 2, notCompleted: 1, pending: 0 },
    { date: "2026-10-13T00:00:00", completed: 0, notCompleted: 0, pending: 0 },
    { date: `${TODAY}T00:00:00`, completed: 1, notCompleted: 0, pending: 2 },
  ],
  habits: [item(1, "Ler", 0.6667, 1), item(2, "Correr", null, 0), item(3, "Meditar", 0.8333, 12)],
};

const EMPTY_STATS: HabitStats = { ...STATS, days: [], habits: [] };

type Seeds = {
  tasks?: Task[];
  occurrences?: Occurrence[];
  stats?: HabitStats;
};

function renderDashboards({ tasks = [], occurrences = [], stats }: Seeds = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const seed = <T,>(data: T): ServerSeed<T> => ({ data, fetchedAt: Date.now() });
  return render(
    <Dashboards
      today={TODAY}
      tasksSeed={seed(tasks)}
      occurrencesSeed={seed(occurrences)}
      statsSeed={stats ? seed(stats) : undefined}
    />,
    { wrapper },
  );
}

/** Only the tasks are left for the client to fetch. */
function renderWithoutTasksSeed() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Dashboards
        today={TODAY}
        occurrencesSeed={{ data: [], fetchedAt: Date.now() }}
        statsSeed={{ data: STATS, fetchedAt: Date.now() }}
      />
    </QueryClientProvider>,
  );
}

const ok = (data: unknown) => ({ data, response: new Response(null, { status: 200 }) });
const failure = () => ({
  error: { status: 500 },
  response: new Response(null, { status: 500 }),
});

function card(name: string) {
  return screen.getByRole("group", { name });
}

beforeEach(() => {
  get.mockReset();
});

describe("Dashboards", () => {
  it("is a region named Resumo with the four cards and two charts", () => {
    renderDashboards({ stats: STATS });

    const summary = screen.getByRole("region", { name: "Resumo" });
    for (const name of [
      "Progresso do dia",
      "Atrasadas",
      "Maior sequência",
      "Conclusão em 30 dias",
    ]) {
      expect(within(summary).getByRole("group", { name })).toBeInTheDocument();
    }
    expect(within(summary).getByRole("region", { name: "Últimos 30 dias" })).toBeInTheDocument();
    expect(within(summary).getByRole("region", { name: "Por hábito" })).toBeInTheDocument();
  });

  it("shows today's progress of habits and tasks, rounded", () => {
    renderDashboards({
      stats: STATS,
      occurrences: [occurrence(1, "Completed"), occurrence(2)],
      tasks: [task(1, `${TODAY}T00:00:00`)],
    });

    expect(card("Progresso do dia")).toHaveTextContent("33%");
    expect(card("Progresso do dia")).toHaveTextContent("1 de 3 concluídos");
  });

  it("shows a dash when nothing is planned for today", () => {
    renderDashboards({ stats: STATS });

    expect(card("Progresso do dia")).toHaveTextContent("—");
    expect(card("Progresso do dia")).toHaveTextContent("Nada previsto para hoje");
  });

  it("counts overdue pending tasks and links to the tasks page", () => {
    renderDashboards({
      stats: STATS,
      tasks: [
        task(1, "2026-10-10T00:00:00"),
        task(2, "2026-10-11T00:00:00"),
        task(3, "2026-10-11T00:00:00", "Completed"),
        task(4, `${TODAY}T00:00:00`),
      ],
    });

    expect(card("Atrasadas")).toHaveTextContent("2");
    expect(within(card("Atrasadas")).getByRole("link", { name: "Ver tarefas" })).toHaveAttribute(
      "href",
      "/tasks",
    );
  });

  it("shows the highest current streak with its habit, in occurrences", () => {
    renderDashboards({ stats: STATS });

    expect(card("Maior sequência")).toHaveTextContent("12 seguidas");
    expect(card("Maior sequência")).toHaveTextContent("Meditar");
  });

  it("says when no habit has a streak yet", () => {
    renderDashboards({ stats: { ...STATS, habits: [item(1, "Ler", 0, 0)] } });

    expect(card("Maior sequência")).toHaveTextContent("0 seguidas");
    expect(card("Maior sequência")).toHaveTextContent("Nenhuma sequência ainda");
  });

  it("shows the completion of the window, leaving out today's pending ones", () => {
    renderDashboards({ stats: STATS });

    // 3 completed of 2 + 1 + 1 (today's 2 pending left out).
    expect(card("Conclusão em 30 dias")).toHaveTextContent("75%");
    expect(card("Conclusão em 30 dias")).toHaveTextContent("3 de 4 feitos");
  });

  it("shows a dash for the completion when there is nothing to count", () => {
    renderDashboards({
      stats: {
        ...STATS,
        days: [{ date: `${TODAY}T00:00:00`, completed: 0, notCompleted: 0, pending: 1 }],
      },
    });

    expect(card("Conclusão em 30 dias")).toHaveTextContent("—");
    expect(card("Conclusão em 30 dias")).toHaveTextContent("Nada para contar ainda");
  });

  it("draws the last days as an image with a summary and a table of the numbers", () => {
    renderDashboards({ stats: STATS });

    const chart = screen.getByRole("region", { name: "Últimos 30 dias" });
    expect(
      within(chart).getByRole("img", {
        name: "Últimos 3 dias: 3 feitos, 1 não feito, 2 pendentes",
      }),
    ).toBeInTheDocument();
    // On the axis and in the table.
    expect(within(chart).getAllByText("12/10")).toHaveLength(2);
    expect(
      within(chart).getByTitle("14/10: 1 feito, 0 não feitos, 2 pendentes"),
    ).toBeInTheDocument();
    const table = within(chart).getByRole("table", { hidden: true });
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(4);
  });

  it("lists every habit by completion rate, rounded, with no rate last", () => {
    renderDashboards({ stats: STATS });

    const list = within(screen.getByRole("region", { name: "Por hábito" })).getByRole("list", {
      name: "Conclusão por hábito",
    });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Meditar83%Sequência atual: 12 seguidas",
      "Ler67%Sequência atual: 1 seguida",
      "Correr—Sequência atual: 0 seguidas",
    ]);
  });

  it("invites to create a habit when there are none", () => {
    renderDashboards({ stats: EMPTY_STATS });

    expect(screen.getByText("Nada para mostrar ainda")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar hábito" })).toHaveAttribute("href", "/habits");
    expect(screen.queryByRole("region", { name: "Por hábito" })).not.toBeInTheDocument();
    expect(card("Maior sequência")).toHaveTextContent("Nenhum hábito ainda");
    expect(card("Conclusão em 30 dias")).toHaveTextContent("—");
  });

  it("shows skeletons while the history loads without a server seed", () => {
    get.mockReturnValue(new Promise(() => {}));
    renderDashboards();

    expect(screen.getByRole("status", { name: "Carregando sequências" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Carregando conclusão" })).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Carregando o histórico dos últimos 30 dias" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Carregando a conclusão por hábito" }),
    ).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/api/habits/stats", { params: { query: { days: 30 } } });
  });

  it("shows an error with a retry that refetches the history", async () => {
    get.mockResolvedValueOnce(failure());
    renderDashboards();

    const chart = screen.getByRole("region", { name: "Por hábito" });
    const alert = await within(chart).findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar o histórico");
    expect(card("Maior sequência")).toHaveTextContent("Não foi possível carregar o histórico");

    get.mockResolvedValueOnce(ok(STATS));
    await userEvent.click(within(alert).getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => expect(card("Maior sequência")).toHaveTextContent("12 seguidas"));
  });

  it("shows an error in the task cards when the tasks cannot be read", async () => {
    get.mockResolvedValue(failure());
    renderWithoutTasksSeed();
    expect(screen.getByRole("status", { name: "Carregando progresso" })).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Carregando tarefas atrasadas" }),
    ).toBeInTheDocument();

    const progressAlert = await within(card("Progresso do dia")).findByRole("alert");
    expect(within(card("Atrasadas")).getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as tarefas",
    );

    get.mockResolvedValue(ok([task(1, "2026-10-10T00:00:00")]));
    await userEvent.click(within(progressAlert).getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => expect(card("Atrasadas")).toHaveTextContent("1"));
  });
});
