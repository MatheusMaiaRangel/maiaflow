import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFail, apiOk, makeHabit, renderWithQuery } from "@/components/habits/test-utils";
import { setMediaMatches } from "@/test/media";
import type { DashboardConfig, WidgetConfig } from "@/lib/widgets/config";
import { DEFAULT_DASHBOARD } from "@/lib/widgets/default-dashboard";
import { CONFLICT_MESSAGE } from "@/lib/widgets/storage";
import type { Dashboard } from "@/lib/widgets/stored";
import { DashboardBoard } from "./dashboard-board";

const api = { GET: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() };
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/api/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser")>()),
  getBrowserApi: () => api,
}));
vi.mock("sonner", () => ({ toast }));

const TODAY = "2026-10-14";

function seed(config: DashboardConfig = DEFAULT_DASHBOARD, revision = 0) {
  return {
    data: { revision, config, isDefault: revision === 0 } satisfies Dashboard,
    fetchedAt: Date.now(),
  };
}

/** `null`: the server could not seed the dashboard. */
function renderBoard(dashboardSeed: ReturnType<typeof seed> | null = seed()) {
  return renderWithQuery(
    <DashboardBoard
      today={TODAY}
      tasksSeed={{ data: [], fetchedAt: Date.now() }}
      dashboardSeed={dashboardSeed ?? undefined}
    />,
  );
}

/** The configuration sent by the last PUT. */
function savedConfig(): DashboardConfig {
  const [, init] = api.PUT.mock.calls.at(-1)!;
  return init.body.config as DashboardConfig;
}

function savedWidget(id: string): WidgetConfig | undefined {
  return savedConfig()
    .sections.flatMap((section) => section.widgets)
    .find((widget) => widget.id === id);
}

async function startEditing() {
  await userEvent.click(screen.getByRole("button", { name: "Editar painel" }));
}

beforeEach(() => {
  for (const method of Object.values(api)) method.mockReset();
  toast.error.mockReset();
  api.GET.mockImplementation(async (path: string) => {
    if (path === "/api/dashboard") return apiOk({ revision: 0, config: null });
    if (path === "/api/habits") return apiOk([makeHabit({ id: 4, title: "Ler" })]);
    return apiOk([]);
  });
  api.PUT.mockImplementation(
    async (_: string, { body }: { body: { revision: number; config: unknown } }) =>
      apiOk({ revision: body.revision + 1, config: body.config }),
  );
  api.DELETE.mockResolvedValue(apiOk(undefined, 204));
});

// Whole dashboards with charts; under coverage in parallel some flows need more than 5 s.
describe("DashboardBoard", { timeout: 20_000 }, () => {
  it("shows the dashboard read-only until the user starts editing", async () => {
    renderBoard();

    expect(screen.getByRole("region", { name: "Tarefas" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar gráfico" })).not.toBeInTheDocument();

    await startEditing();
    expect(screen.getByRole("button", { name: "Adicionar gráfico" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Renomear a seção Tarefas" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Concluir" }));
    expect(screen.getByRole("button", { name: "Editar painel" })).toBeInTheDocument();
    expect(api.PUT).not.toHaveBeenCalled();
  });

  it("loads the dashboard when the server could not seed it, and reports a failure", async () => {
    api.GET.mockImplementation(async (path: string) =>
      path === "/api/dashboard" ? apiFail(500, {}) : apiOk([]),
    );
    renderBoard(null);

    expect(screen.getByRole("status", { name: "Carregando o painel" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });

  it("shows a stored dashboard fetched by the client", async () => {
    const config: DashboardConfig = {
      version: 1,
      sections: [{ id: "minha", title: "Minha seção", widgets: [] }],
    };
    api.GET.mockImplementation(async (path: string) =>
      path === "/api/dashboard" ? apiOk({ revision: 4, config }) : apiOk([]),
    );
    renderBoard(null);

    expect(await screen.findByRole("region", { name: "Minha seção" })).toBeInTheDocument();
  });

  describe("on phones", () => {
    it("moves a widget down and saves the new order with the current revision", async () => {
      renderBoard(seed(DEFAULT_DASHBOARD, 3));
      await startEditing();

      await userEvent.click(screen.getByRole("button", { name: "Descer Concluídas por dia" }));

      await waitFor(() => expect(api.PUT).toHaveBeenCalledTimes(1));
      expect(api.PUT.mock.calls[0]![1].body.revision).toBe(3);
      expect(savedWidget("tasks-on-time")?.layout).toMatchObject({ x: 0, y: 0 });
      expect(screen.getByText("Concluídas por dia: posição 2 de 4.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Subir Concluídas por dia" })).toHaveAttribute(
        "aria-disabled",
        "false",
      );
    });

    it("saves one change after the other, each with the revision the last one returned", async () => {
      renderBoard();
      await startEditing();

      await userEvent.click(screen.getByRole("button", { name: "Descer Concluídas por dia" }));
      await userEvent.click(screen.getByRole("button", { name: "Descer Concluídas por dia" }));

      await waitFor(() => expect(api.PUT).toHaveBeenCalledTimes(2));
      expect(api.PUT.mock.calls.map(([, init]) => init.body.revision)).toEqual([0, 1]);
    });
  });

  describe("on wide screens", () => {
    beforeEach(() => setMediaMatches(true));

    it("moves a widget with the keyboard and saves it when dropped", async () => {
      renderBoard();
      await startEditing();
      const widget = screen.getByRole("group", { name: /^Concluídas por dia: coluna 1, linha 1/ });

      widget.focus();
      await userEvent.keyboard("{Enter}");
      expect(screen.getByText(/Concluídas por dia selecionado/)).toBeInTheDocument();
      await userEvent.keyboard("{ArrowRight}{ArrowRight}");
      expect(screen.getByText(/coluna 3, linha 1/)).toBeInTheDocument();
      expect(api.PUT).not.toHaveBeenCalled();
      await userEvent.keyboard("{Enter}");

      await waitFor(() => expect(api.PUT).toHaveBeenCalledTimes(1));
      expect(savedWidget("tasks-per-day")?.layout).toEqual({ x: 2, y: 0, w: 2, h: 2 });
      expect(screen.getByText(/^Solto\. Concluídas por dia: coluna 3/)).toBeInTheDocument();
    });

    it("resizes with Shift and arrows", async () => {
      renderBoard();
      await startEditing();

      screen.getByRole("group", { name: /^No prazo:/ }).focus();
      await userEvent.keyboard("{Enter}{Shift>}{ArrowDown}{/Shift}{Enter}");

      await waitFor(() => expect(api.PUT).toHaveBeenCalledTimes(1));
      expect(savedWidget("tasks-on-time")?.layout).toMatchObject({ h: 2 });
    });

    it("cancels with Escape or when focus leaves, without saving", async () => {
      renderBoard();
      await startEditing();
      const widget = screen.getByRole("group", { name: /^No prazo:/ });

      widget.focus();
      await userEvent.keyboard("{Enter}{ArrowLeft}{Escape}");
      expect(screen.getByText(/^Cancelado\. No prazo: coluna 3/)).toBeInTheDocument();

      widget.focus();
      await userEvent.keyboard("{Enter}{ArrowLeft}");
      await userEvent.tab();
      expect(screen.getByText(/^Cancelado\. No prazo: coluna 3/)).toBeInTheDocument();
      expect(api.PUT).not.toHaveBeenCalled();
    });

    it("ignores arrows when the widget was not picked up", async () => {
      renderBoard();
      await startEditing();

      screen.getByRole("group", { name: /^No prazo:/ }).focus();
      await userEvent.keyboard("{ArrowLeft}{Enter}{Enter}");

      expect(api.PUT).not.toHaveBeenCalled();
    });
  });

  it("deletes a widget after confirming", async () => {
    renderBoard();
    await startEditing();

    await userEvent.click(screen.getByRole("button", { name: "Excluir No prazo" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("“No prazo” sai do painel em todos os aparelhos.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(api.PUT).toHaveBeenCalledTimes(1));
    expect(savedWidget("tasks-on-time")).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Excluir No prazo" })).not.toBeInTheDocument();
  });

  it("restores the default dashboard after confirming", async () => {
    renderBoard(seed({ version: 1, sections: [] }, 2));
    await startEditing();
    expect(screen.getByText(/O painel está vazio/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Restaurar padrão" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Restaurar" }),
    );

    await waitFor(() => expect(api.DELETE).toHaveBeenCalledWith("/api/dashboard"));
    expect(screen.getByRole("region", { name: "Tarefas" })).toBeInTheDocument();
  });

  it("adds, renames and deletes an empty section", async () => {
    renderBoard();
    await startEditing();

    await userEvent.click(screen.getByRole("button", { name: "Adicionar seção" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("O nome precisa ter de 1 a 40 caracteres.");
    await userEvent.type(screen.getByLabelText("Nome da seção"), "Metas");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(api.PUT).toHaveBeenCalledTimes(1));
    expect(savedConfig().sections.at(-1)).toMatchObject({ title: "Metas", widgets: [] });
    expect(screen.getByText(/Seção vazia/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Renomear a seção Metas" }));
    const name = screen.getByLabelText("Nome da seção");
    await userEvent.clear(name);
    await userEvent.type(name, "Objetivos");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(savedConfig().sections.at(-1)?.title).toBe("Objetivos"));

    await userEvent.click(screen.getByRole("button", { name: "Excluir a seção Objetivos" }));
    await waitFor(() => expect(savedConfig().sections).toHaveLength(3));
    expect(
      screen.queryByRole("button", { name: "Excluir a seção Tarefas" }),
    ).not.toBeInTheDocument();
  });

  it("refuses a ninth section", async () => {
    const sections = Array.from({ length: 8 }, (_, index) => ({
      id: `s${index}`,
      title: `Seção ${index}`,
      widgets: [],
    }));
    renderBoard(seed({ version: 1, sections }, 1));
    await startEditing();

    await userEvent.click(screen.getByRole("button", { name: "Adicionar seção" }));

    expect(toast.error).toHaveBeenCalledWith("O painel já tem 8 seções, o máximo.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("adds a new widget at the end of the first section", async () => {
    renderBoard();
    await startEditing();

    await userEvent.click(screen.getByRole("button", { name: "Adicionar gráfico" }));
    const dialog = screen.getByRole("dialog", { name: "Novo gráfico" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(api.PUT).toHaveBeenCalledTimes(1));
    const added = savedConfig().sections[0]!.widgets.at(-1)!;
    expect(added).toMatchObject({ title: "Novo gráfico", layout: { x: 0, y: 2 } });
    expect(added.id).toMatch(/^w-[a-z0-9-]{8}$/);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("creates a section for the first widget of an empty dashboard", async () => {
    renderBoard(seed({ version: 1, sections: [] }, 1));
    await startEditing();

    await userEvent.click(screen.getByRole("button", { name: "Adicionar gráfico" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(api.PUT).toHaveBeenCalledTimes(1));
    expect(savedConfig().sections).toEqual([
      expect.objectContaining({ id: "graficos", title: "Gráficos" }),
    ]);
  });

  it("refuses a widget past the limit", async () => {
    const widgets = Array.from({ length: 30 }, (_, index) => ({
      ...DEFAULT_DASHBOARD.sections[0]!.widgets[1]!,
      id: `w${index}`,
      layout: { x: index % 4, y: Math.floor(index / 4), w: 1, h: 1 },
    }));
    renderBoard(seed({ version: 1, sections: [{ id: "s", title: "Muitos", widgets }] }, 1));
    await startEditing();

    await userEvent.click(screen.getByRole("button", { name: "Adicionar gráfico" }));

    expect(toast.error).toHaveBeenCalledWith("O painel já tem 30 gráficos, o máximo.");
  });

  it("edits a widget and deletes one from the editor", async () => {
    renderBoard();
    await startEditing();

    await userEvent.click(screen.getByRole("button", { name: "Editar No prazo" }));
    const dialog = screen.getByRole("dialog", { name: "Editar gráfico" });
    const title = within(dialog).getByLabelText("Título");
    await userEvent.clear(title);
    await userEvent.type(title, "Pontualidade");
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(savedWidget("tasks-on-time")?.title).toBe("Pontualidade"));

    await userEvent.click(screen.getByRole("button", { name: "Editar Situação" }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Excluir" }),
    );
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }),
    );
    await waitFor(() => expect(savedWidget("tasks-status")).toBeUndefined());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the newest version when another device saved first", async () => {
    api.PUT.mockResolvedValue(apiFail(409, { detail: "Conflito" }));
    renderBoard();
    await startEditing();

    await userEvent.click(screen.getByRole("button", { name: "Descer Concluídas por dia" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(CONFLICT_MESSAGE));
    await waitFor(() => expect(api.GET).toHaveBeenCalledWith("/api/dashboard"));
  });

  it("drops the saves queued behind a failed one, so they cannot overwrite another device", async () => {
    let fail: (value: unknown) => void = () => {};
    api.PUT.mockImplementationOnce(() => new Promise((resolve) => (fail = resolve)));
    renderBoard();
    await startEditing();

    await userEvent.click(screen.getByRole("button", { name: "Descer Concluídas por dia" }));
    await userEvent.click(screen.getByRole("button", { name: "Descer Concluídas por dia" }));
    fail(apiFail(409, { detail: "Conflito" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(CONFLICT_MESSAGE));
    await waitFor(() => expect(api.GET).toHaveBeenCalledWith("/api/dashboard"));
    expect(api.PUT).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Descer Concluídas por dia" }));
    await waitFor(() => expect(api.PUT).toHaveBeenCalledTimes(2));
  });

  it("announces the same message again when it repeats", async () => {
    setMediaMatches(true);
    renderBoard();
    await startEditing();

    screen.getByRole("group", { name: /^No prazo:/ }).focus();
    await userEvent.keyboard("{Enter}{ArrowUp}");
    const place = "No prazo: coluna 3, linha 1, 1 de largura por 1 de altura.";
    expect(screen.getByText(place)).toBeInTheDocument();
    await userEvent.keyboard("{ArrowUp}");

    expect(screen.getByText(`${place}\u00a0`, { normalizer: (text) => text })).toBeInTheDocument();
  });

  it("explains other save failures and a failed reset", async () => {
    api.PUT.mockResolvedValue(apiFail(400, { detail: "Cor inválida." }));
    api.DELETE.mockResolvedValue(apiFail(500, {}));
    renderBoard();
    await startEditing();

    await userEvent.click(screen.getByRole("button", { name: "Descer Concluídas por dia" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Cor inválida."));

    await userEvent.click(screen.getByRole("button", { name: "Restaurar padrão" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Restaurar" }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Não foi possível restaurar o painel padrão. Tente novamente.",
      ),
    );
  });
});
