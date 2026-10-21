import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Occurrence } from "@/lib/habits/occurrences";
import type { HabitStats, HabitStatsItem } from "@/lib/habits/stats";
import type { ServerSeed } from "@/lib/query-seed";
import type { Task } from "@/lib/tasks/hooks";
import { DEFAULT_DASHBOARD } from "@/lib/widgets/default-dashboard";
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

const DEFAULT_SEED = { revision: 0, config: DEFAULT_DASHBOARD, isDefault: true };

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
      dashboardSeed={seed(DEFAULT_SEED)}
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
        dashboardSeed={{ data: DEFAULT_SEED, fetchedAt: Date.now() }}
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

function widget(name: string) {
  return screen.getByRole("region", { name });
}

function dated(habitId: number, habitTitle: string, date: string, status: Occurrence["status"]) {
  return {
    id: habitId * 100 + Number(date.slice(8)),
    habitId,
    habitTitle,
    date: `${date}T00:00:00`,
    status,
  };
}

/** Two habits over the last three days (today's "Ler" still pending). */
const HISTORY: Occurrence[] = [
  dated(1, "Ler", "2026-10-12", "Completed"),
  dated(1, "Ler", "2026-10-13", "NotCompleted"),
  dated(1, "Ler", TODAY, "Pending"),
  dated(3, "Meditar", "2026-10-13", "Completed"),
  dated(3, "Meditar", TODAY, "Completed"),
];

beforeEach(() => {
  get.mockReset();
});

describe("Dashboards", () => {
  it("is a region named Resumo with the four cards", () => {
    get.mockReturnValue(new Promise(() => {}));
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

  it("shows the default dashboard below the cards: Tarefas, Hábitos and Tendências", () => {
    get.mockReturnValue(new Promise(() => {}));
    renderDashboards({ stats: STATS });

    const summary = screen.getByRole("region", { name: "Resumo" });
    const sections = {
      Tarefas: ["Concluídas por dia", "No prazo", "Situação", "Próximos 7 dias"],
      Hábitos: ["Últimos 30 dias", "Por hábito"],
      Tendências: ["Mapa de 90 dias", "Por dia da semana"],
    };
    for (const [section, widgets] of Object.entries(sections)) {
      const region = within(summary).getByRole("region", { name: section });
      for (const widget of widgets) {
        expect(within(region).getByRole("region", { name: widget })).toBeInTheDocument();
      }
    }
  });

  it("computes the task widgets from the task list", () => {
    get.mockReturnValue(new Promise(() => {}));
    renderDashboards({
      stats: STATS,
      tasks: [
        { ...task(1, "2026-10-14T00:00:00", "Completed"), completedOn: TODAY },
        { ...task(2, "2026-10-10T00:00:00", "Completed"), completedOn: "2026-10-12" },
        task(3, "2026-10-01T00:00:00"),
        task(4, null),
      ],
    });

    expect(widget("No prazo")).toHaveTextContent("50%");
    expect(widget("No prazo")).toHaveTextContent("Concluídas no prazo: 1 de 2");
    expect(within(widget("Situação")).getByRole("img")).toHaveAccessibleName(
      "Situação: No prazo: 0 no total. Atrasadas: 1 no total. Sem prazo: 1 no total. Concluídas em 30 dias: 2 no total.",
    );
  });

  it("loads the habit history once from the calendar and lists every habit by completion rate", async () => {
    get.mockImplementation((path: string) =>
      Promise.resolve(path === "/api/habits/calendar" ? ok(HISTORY) : ok(STATS)),
    );
    renderDashboards({ stats: STATS });

    const list = await within(widget("Por hábito")).findByRole("list", { name: "Por hábito" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((row) => row.textContent),
    ).toEqual([
      "MeditarConclusão: 100%Sequência atual: 2 seguidas",
      "LerConclusão: 50%Sequência atual: 0 seguidas",
    ]);
    const calendarCalls = get.mock.calls.filter(([path]) => path === "/api/habits/calendar");
    expect(calendarCalls).toEqual([
      ["/api/habits/calendar", { params: { query: { start: "2025-10-15", end: TODAY } } }],
    ]);
  });

  it("invites to look at tasks or habits when a widget has nothing to show", async () => {
    get.mockResolvedValue(ok([]));
    renderDashboards({ stats: EMPTY_STATS });

    expect(
      within(widget("Concluídas por dia")).getByRole("link", { name: "Ver tarefas" }),
    ).toHaveAttribute("href", "/tasks");
    const habits = widget("Últimos 30 dias");
    expect(await within(habits).findByRole("link", { name: "Ver hábitos" })).toHaveAttribute(
      "href",
      "/habits",
    );
    expect(habits).toHaveTextContent("Nada para mostrar neste período ainda.");
    expect(card("Maior sequência")).toHaveTextContent("Nenhum hábito ainda");
  });

  it("shows skeletons while the history loads without a server seed", () => {
    get.mockReturnValue(new Promise(() => {}));
    renderDashboards();

    expect(screen.getByRole("status", { name: "Carregando sequências" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Carregando conclusão" })).toBeInTheDocument();
    for (const name of ["Últimos 30 dias", "Por hábito", "Mapa de 90 dias", "Por dia da semana"]) {
      expect(screen.getByRole("status", { name: `Carregando ${name}` })).toBeInTheDocument();
    }
    expect(get).toHaveBeenCalledWith("/api/habits/stats", { params: { query: { days: 30 } } });
  });

  it("shows an error with a retry in the habit widgets when the history cannot be read", async () => {
    get.mockImplementation((path: string) =>
      Promise.resolve(path === "/api/habits/calendar" ? failure() : ok(STATS)),
    );
    renderDashboards({ stats: STATS });

    const alert = await within(widget("Por hábito")).findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar os hábitos");
    expect(within(widget("Mapa de 90 dias")).getByRole("alert")).toBeInTheDocument();

    get.mockImplementation((path: string) =>
      Promise.resolve(path === "/api/habits/calendar" ? ok(HISTORY) : ok(STATS)),
    );
    await userEvent.click(within(alert).getByRole("button", { name: "Tentar novamente" }));

    expect(
      await within(widget("Por hábito")).findByRole("list", { name: "Por hábito" }),
    ).toBeInTheDocument();
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
