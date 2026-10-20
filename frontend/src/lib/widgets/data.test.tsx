import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Occurrence } from "@/lib/habits/occurrences";
import type { Task } from "@/lib/tasks/hooks";
import type { WidgetConfig } from "./config";
import { habitRangeFor, useDashboardSources, widgetState, type Source } from "./data";

const get = vi.fn();
vi.mock("@/lib/api/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser")>()),
  getBrowserApi: () => ({ GET: get }),
}));

const TODAY = "2026-10-17";
const ok = (data: unknown) => ({ data, response: new Response(null, { status: 200 }) });

function widget(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    id: "w",
    title: "W",
    chart: "bar",
    series: [{ metric: { variable: "tasks.completed" }, label: "A", color: "blue" }],
    grouping: "none",
    period: { kind: "last", days: 7 },
    habitFilter: { kind: "all" },
    layout: { x: 0, y: 0, w: 1, h: 1 },
    ...overrides,
  };
}

const habitWidget = (period: WidgetConfig["period"]) =>
  widget({
    series: [{ metric: { variable: "habits.completed" }, label: "H", color: "done" }],
    period,
  });

function source<T>(data: T | undefined, isError = false): Source<T> {
  return { data, isError, refetch: vi.fn() };
}

const task: Task = {
  id: 1,
  title: "T",
  description: null,
  dueDate: null,
  status: "Completed",
  createdOn: TODAY,
  completedOn: TODAY,
};
const occurrence: Occurrence = {
  id: 1,
  habitId: 1,
  habitTitle: "Ler",
  date: `${TODAY}T00:00:00`,
  status: "Completed",
};

beforeEach(() => get.mockReset());

describe("habitRangeFor", () => {
  it("joins the habit ranges of all widgets and ignores task widgets", () => {
    expect(habitRangeFor([widget()], TODAY)).toBeNull();
    expect(
      habitRangeFor(
        [widget(), habitWidget({ kind: "last", days: 30 }), habitWidget({ kind: "next", days: 7 })],
        TODAY,
      ),
    ).toEqual({ from: "2026-09-18", to: "2026-10-23" });
  });
});

describe("widgetState", () => {
  it("waits for the data the widget needs, and only that", () => {
    const loadingHabits = { tasks: source([task]), occurrences: source<Occurrence[]>(undefined) };
    expect(widgetState(widget(), loadingHabits, TODAY).status).toBe("ready");
    expect(widgetState(habitWidget({ kind: "last", days: 7 }), loadingHabits, TODAY)).toEqual({
      status: "loading",
    });
  });

  it("reports which data failed, with a retry", () => {
    const tasks = source<Task[]>(undefined, true);
    const occurrences = source<Occurrence[]>(undefined, true);

    const taskState = widgetState(widget(), { tasks, occurrences }, TODAY);
    const habitState = widgetState(
      habitWidget({ kind: "last", days: 7 }),
      { tasks, occurrences },
      TODAY,
    );

    expect(taskState).toMatchObject({ status: "error", what: "as tarefas" });
    expect(habitState).toMatchObject({ status: "error", what: "os hábitos" });
    if (taskState.status === "error") taskState.retry();
    if (habitState.status === "error") habitState.retry();
    expect(tasks.refetch).toHaveBeenCalled();
    expect(occurrences.refetch).toHaveBeenCalled();
  });

  it("keeps showing data it already has when a refetch fails", () => {
    const state = widgetState(
      widget(),
      { tasks: source([task], true), occurrences: source<Occurrence[]>([]) },
      TODAY,
    );
    expect(state.status).toBe("ready");
  });

  it("does not compute a widget whose configuration is invalid", () => {
    const state = widgetState(
      widget({ grouping: "habit" }),
      { tasks: source([task]), occurrences: source([occurrence]) },
      TODAY,
    );
    expect(state).toEqual({
      status: "invalid",
      errors: ["Agrupar por hábito só funciona com métricas de hábitos."],
    });
  });

  it("computes the metrics once the data is there", () => {
    const state = widgetState(
      habitWidget({ kind: "last", days: 7 }),
      { tasks: source([task]), occurrences: source([occurrence]) },
      TODAY,
    );
    expect(state).toMatchObject({ status: "ready", result: { series: [{ values: [1] }] } });
  });
});

describe("useDashboardSources", () => {
  function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  it("loads tasks and the habit days of all widgets, splitting spans longer than 366 days", async () => {
    get.mockImplementation((path: string, options?: { params: { query: { start: string } } }) =>
      Promise.resolve(
        path === "/api/tasks"
          ? ok([task])
          : ok([{ ...occurrence, id: options?.params.query.start === "2025-10-16" ? 2 : 3 }]),
      ),
    );
    const widgets = [
      habitWidget({ kind: "custom", from: "2025-10-16", to: "2026-10-16" }),
      habitWidget({ kind: "next", days: 7 }),
    ];

    const { result } = renderHook(() => useDashboardSources(widgets, TODAY), { wrapper });

    await waitFor(() => expect(result.current.occurrences.data).toHaveLength(2));
    expect(get).toHaveBeenCalledWith("/api/habits/calendar", {
      params: { query: { start: "2025-10-16", end: "2026-10-16" } },
    });
    expect(get).toHaveBeenCalledWith("/api/habits/calendar", {
      params: { query: { start: "2026-10-17", end: "2026-10-23" } },
    });
    await waitFor(() => expect(result.current.tasks.data).toEqual([task]));
  });

  it("reports a failure and refetches every piece on retry", async () => {
    get.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/api/tasks"
          ? ok([])
          : { error: { status: 500 }, response: new Response(null, { status: 500 }) },
      ),
    );
    const { result } = renderHook(
      () => useDashboardSources([habitWidget({ kind: "last", days: 7 })], TODAY),
      { wrapper },
    );

    await waitFor(() => expect(result.current.occurrences.isError).toBe(true));
    get.mockResolvedValue(ok([occurrence]));
    await result.current.occurrences.refetch();
    await waitFor(() => expect(result.current.occurrences.data).toEqual([occurrence]));
  });

  it("asks for no habit days when no widget needs them", () => {
    get.mockResolvedValue(ok([]));
    const { result } = renderHook(() => useDashboardSources([widget()], TODAY), { wrapper });
    expect(result.current.occurrences.data).toEqual([]);
    expect(get).not.toHaveBeenCalledWith("/api/habits/calendar", expect.anything());
  });
});
