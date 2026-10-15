import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const get = vi.fn();
const patch = vi.fn();
const toastError = vi.fn();

vi.mock("@/lib/api/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser")>()),
  getBrowserApi: () => ({ GET: get, PATCH: patch }),
}));
vi.mock("sonner", () => ({ toast: { error: (message: string) => toastError(message) } }));

import type { Occurrence } from "@/lib/habits/occurrences";
import { HabitCalendar } from "./habit-calendar";

const TODAY = "2026-10-14";

function occurrence(
  id: number,
  date: string,
  status: Occurrence["status"] = "Pending",
): Occurrence {
  return {
    id,
    habitId: id || 5,
    habitTitle: `Hábito ${id || "futuro"}`,
    date: `${date}T00:00:00`,
    status,
  };
}

const seedData = [
  occurrence(1, "2026-10-14"),
  occurrence(2, "2026-10-14", "Completed"),
  occurrence(0, "2026-10-16"),
];

function ok<T>(data: T) {
  return { data, response: new Response(null, { status: 200 }) };
}

function renderCalendar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <HabitCalendar today={TODAY} seed={{ data: seedData, fetchedAt: Date.now() }} />
    </QueryClientProvider>,
  );
}

function monthTitle() {
  return screen.getByRole("heading", { level: 2 });
}

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
  toastError.mockReset();
});

describe("HabitCalendar", () => {
  test("opens on the current month with today selected, without requesting anything", () => {
    renderCalendar();

    expect(monthTitle()).toHaveTextContent("outubro de 2026");
    expect(screen.getByRole("button", { name: /^14 de outubro/ })).toHaveAttribute(
      "aria-current",
      "date",
    );
    expect(
      screen.getByRole("heading", { name: "quarta-feira, 14 de outubro" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hábito 1")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  test("announces the month title politely", () => {
    renderCalendar();

    expect(monthTitle()).toHaveAttribute("aria-live", "polite");
  });

  test("selecting a day shows its habits; future days are disabled with an explanation", async () => {
    renderCalendar();

    await userEvent.click(screen.getByRole("button", { name: /^16 de outubro/ }));

    expect(screen.getByRole("heading", { name: "sexta-feira, 16 de outubro" })).toBeInTheDocument();
    expect(screen.getByText("Hábito futuro")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Feito" })).toBeDisabled();
    expect(screen.getByText(/Ainda não chegou o dia/)).toBeInTheDocument();
  });

  test("changes a status through the API and refreshes the day", async () => {
    patch.mockResolvedValue(ok(occurrence(1, "2026-10-14", "Completed")));
    get.mockResolvedValue(
      ok(
        seedData.map((item) => (item.id === 1 ? { ...item, status: "Completed" as const } : item)),
      ),
    );
    renderCalendar();

    const first = screen.getAllByRole("listitem")[0];
    await userEvent.click(within(first).getByRole("button", { name: "Feito" }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/api/habits/occurrences/{occurrenceId}/status", {
        params: { path: { occurrenceId: 1 } },
        body: { status: "Completed" },
      }),
    );
    expect(
      await screen.findByRole("button", { name: "14 de outubro, 2 hábitos, 2 feitos" }),
    ).toBeInTheDocument();
  });

  test("shows an error toast and restores the status when the update fails", async () => {
    patch.mockResolvedValue({
      error: { status: 500, detail: "Falha ao salvar." },
      response: new Response(null, { status: 500 }),
    });
    get.mockResolvedValue(ok(seedData));
    renderCalendar();

    const first = screen.getAllByRole("listitem")[0];
    await userEvent.click(within(first).getByRole("button", { name: "Não feito" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Falha ao salvar."));
    await waitFor(() =>
      expect(
        within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "Pendente" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
  });

  test("loads another month in the browser and shows its title and a skeleton for the day panel", async () => {
    let resolve: (value: unknown) => void = () => {};
    get.mockReturnValue(new Promise((done) => (resolve = done)));
    renderCalendar();

    await userEvent.click(screen.getByRole("button", { name: "Próximo mês" }));

    expect(monthTitle()).toHaveTextContent("novembro de 2026");
    expect(get).toHaveBeenCalledWith("/api/habits/calendar", {
      params: { query: { start: "2026-11-01", end: "2026-12-05" } },
    });
    expect(screen.getByLabelText("Carregando hábitos do dia")).toBeInTheDocument();
    expect(screen.getByRole("grid")).toHaveAttribute("aria-busy", "true");

    resolve(ok([occurrence(3, "2026-11-03")]));
    expect(
      await screen.findByRole("button", { name: "3 de novembro, 1 hábito" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("grid")).not.toHaveAttribute("aria-busy");
  });

  test("goes to the previous month and back to today with the Hoje button", async () => {
    get.mockResolvedValue(ok([]));
    renderCalendar();

    await userEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(monthTitle()).toHaveTextContent("setembro de 2026");
    expect(await screen.findByText(/Nenhum hábito neste dia/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(monthTitle()).toHaveTextContent("outubro de 2026");
    expect(
      screen.getByRole("heading", { name: "quarta-feira, 14 de outubro" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hoje" })).toBeDisabled();
  });

  test("moves to the next month when the keyboard leaves the visible grid", async () => {
    get.mockResolvedValue(ok([]));
    renderCalendar();

    screen.getByRole("button", { name: /^14 de outubro/ }).focus();
    await userEvent.keyboard("{PageDown}");

    expect(monthTitle()).toHaveTextContent("novembro de 2026");
    expect(screen.getByRole("heading", { name: "sábado, 14 de novembro" })).toBeInTheDocument();
  });

  test("selecting a dimmed day of a neighbouring month keeps the month", async () => {
    renderCalendar();

    await userEvent.click(screen.getByRole("button", { name: /^30 de setembro/ }));

    expect(monthTitle()).toHaveTextContent("outubro de 2026");
    expect(
      screen.getByRole("heading", { name: "quarta-feira, 30 de setembro" }),
    ).toBeInTheDocument();
  });

  test("shows an inline error with a retry button when a month fails to load", async () => {
    get.mockResolvedValueOnce({
      error: { status: 500, detail: "Servidor indisponível." },
      response: new Response(null, { status: 500 }),
    });
    renderCalendar();

    await userEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Servidor indisponível.");

    get.mockResolvedValueOnce(ok([occurrence(3, "2026-11-03")]));
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByRole("button", { name: "3 de novembro, 1 hábito" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
