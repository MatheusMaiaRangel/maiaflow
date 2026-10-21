import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiOk, makeHabit, renderWithQuery } from "@/components/habits/test-utils";
import type { WidgetConfig } from "@/lib/widgets/config";
import { DEFAULT_DASHBOARD } from "@/lib/widgets/default-dashboard";
import { newWidget } from "@/lib/widgets/edit";
import { WidgetEditor, type WidgetDraft } from "./widget-editor";

const api = { GET: vi.fn() };
vi.mock("@/lib/api/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser")>()),
  getBrowserApi: () => api,
}));

const TODAY = "2026-10-14";
const onSave = vi.fn();
const onDelete = vi.fn();
const onClose = vi.fn();

function renderEditor(widget: WidgetConfig = newWidget("w-1"), isNew = true) {
  renderWithQuery(
    <WidgetEditor
      initial={{ sectionId: "tasks", widget }}
      isNew={isNew}
      sections={DEFAULT_DASHBOARD.sections}
      today={TODAY}
      tasksSeed={{ data: [], fetchedAt: Date.now() }}
      onSave={onSave}
      onDelete={onDelete}
      onClose={onClose}
    />,
  );
  return screen.getByRole("dialog");
}

function saved(): WidgetDraft {
  return onSave.mock.calls.at(-1)![0] as WidgetDraft;
}

async function choose(label: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

function preview() {
  return screen.getByText("Prévia").parentElement!;
}

beforeEach(() => {
  api.GET.mockReset();
  onSave.mockReset();
  onDelete.mockReset();
  onClose.mockReset();
  api.GET.mockImplementation(async (path: string) =>
    path === "/api/habits"
      ? apiOk([makeHabit({ id: 4, title: "Ler" }), makeHabit({ id: 5, title: "Correr" })])
      : apiOk([]),
  );
});

// The dialog renders many selects and a live chart; under coverage in parallel it needs more than 5 s.
describe("WidgetEditor", { timeout: 20_000 }, () => {
  it("saves the trimmed title and shows it in the live preview", async () => {
    const dialog = renderEditor();
    expect(
      within(dialog).getByRole("heading", { name: "Novo gráfico", level: 2 }),
    ).toBeInTheDocument();

    const title = screen.getByLabelText("Título");
    await userEvent.clear(title);
    await userEvent.type(title, "  Minhas tarefas ");
    expect(within(preview()).getByRole("heading", { name: "Minhas tarefas" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(saved()).toMatchObject({ sectionId: "tasks", widget: { title: "Minhas tarefas" } });
  });

  it("lists what is wrong and does not save an invalid widget", async () => {
    renderEditor();

    await userEvent.clear(screen.getByLabelText("Título"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const alerts = screen.getAllByRole("alert").map((alert) => alert.textContent);
    expect(alerts).toContain("O título precisa ter de 1 a 60 caracteres.");
    expect(alerts.some((text) => text?.startsWith("Este gráfico não pode ser exibido"))).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("turns the chart into a number of one ungrouped metric", async () => {
    renderEditor();

    await userEvent.click(screen.getByRole("button", { name: "Adicionar métrica" }));
    expect(screen.getAllByRole("group", { name: /^Métrica \d$/ })).toHaveLength(2);
    expect(screen.getAllByRole("combobox", { name: "Desenhar como" })).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Número" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(saved().widget).toMatchObject({ chart: "number", grouping: "none" });
    expect(saved().widget.series).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Adicionar métrica" })).not.toBeInTheDocument();
  });

  it("divides one count by another and names the series after both", async () => {
    renderEditor();

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Dividir por outra métrica (A ÷ B em %)" }),
    );
    await choose("Dividir por", "Tarefas criadas");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(saved().widget.series[0]).toMatchObject({
      metric: { variable: "tasks.completed", divideBy: "tasks.created" },
      label: "Tarefas concluídas ÷ Tarefas criadas",
    });
  });

  it("keeps a typed series name when the metric changes", async () => {
    renderEditor();

    const label = screen.getByLabelText("Nome na legenda");
    await userEvent.clear(label);
    // One paste: the select closing from the previous test can move focus between key presses.
    await userEvent.paste("Feitas");
    expect(label).toHaveValue("Feitas");
    await choose("O que medir", "Tarefas criadas");
    expect(screen.getByLabelText("Nome na legenda")).toHaveValue("Feitas");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(saved().widget.series[0]).toMatchObject({
      metric: { variable: "tasks.created" },
      label: "Feitas",
    });
  });

  it("filters habit metrics by one habit and drops the ratio for rates", async () => {
    renderEditor();

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Dividir por outra métrica (A ÷ B em %)" }),
    );
    await choose("O que medir", "Taxa de conclusão");
    expect(screen.queryByRole("combobox", { name: "Dividir por" })).not.toBeInTheDocument();
    await waitFor(() => expect(api.GET).toHaveBeenCalledWith("/api/habits"));
    await choose("Hábitos", "Correr");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(saved().widget).toMatchObject({
      series: [{ metric: { variable: "habits.completionRate" } }],
      habitFilter: { kind: "habit", habitId: 5 },
    });
    expect(saved().widget.series[0]!.metric.divideBy).toBeUndefined();
  });

  it("says when the filtered habit no longer exists", async () => {
    renderEditor({
      ...newWidget("w"),
      series: [{ metric: { variable: "habits.completed" }, label: "Feitos", color: "done" }],
      habitFilter: { kind: "habit", habitId: 99 },
    });

    expect(await screen.findByText("Esse hábito foi excluído. Escolha outro.")).toBeInTheDocument();
    await choose("Hábitos", "Todos os hábitos");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(saved().widget.habitFilter).toEqual({ kind: "all" });
  });

  it("picks a custom period with its own days", async () => {
    renderEditor();

    await choose("Período", "Personalizado");
    const from = screen.getByLabelText("De");
    expect(from).toHaveValue("2026-09-15");
    await userEvent.clear(from);
    await userEvent.type(from, "2026-10-01");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(saved().widget.period).toEqual({ kind: "custom", from: "2026-10-01", to: TODAY });
  });

  it("changes grouping, period preset, section and size", async () => {
    renderEditor();

    await choose("Agrupar", "Por semana");
    await choose("Período", "Próximos 7 dias");
    await choose("Seção", "Tendências");
    await choose("Largura", "4 colunas");
    await choose("Altura", "3 linhas");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(saved()).toMatchObject({
      sectionId: "trends",
      widget: {
        grouping: "week",
        period: { kind: "next", days: 7 },
        layout: { x: 0, w: 4, h: 3 },
      },
    });
  });

  it("stacks, draws one series as a line and removes another", async () => {
    renderEditor();

    await userEvent.click(screen.getByRole("button", { name: "Adicionar métrica" }));
    await userEvent.click(screen.getByRole("button", { name: "Adicionar métrica" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Empilhar as métricas" }));
    const second = screen.getByRole("group", { name: "Métrica 2" });
    await userEvent.click(within(second).getByRole("combobox", { name: "Desenhar como" }));
    await userEvent.click(await screen.findByRole("option", { name: "Linha" }));
    await userEvent.click(screen.getByRole("button", { name: "Remover métrica 3" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(saved().widget.stacked).toBe(true);
    expect(saved().widget.series).toHaveLength(2);
    expect(saved().widget.series[1]).toMatchObject({ mark: "line", color: "orange" });

    await userEvent.click(screen.getByRole("checkbox", { name: "Empilhar as métricas" }));
    await userEvent.click(within(second).getByRole("combobox", { name: "Desenhar como" }));
    await userEvent.click(await screen.findByRole("option", { name: "Igual ao gráfico" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect("stacked" in saved().widget).toBe(false);
    expect("mark" in saved().widget.series[1]!).toBe(false);
  });

  it("recolors a series and tints the card, with a contrast warning for pale colors", async () => {
    renderEditor();

    const seriesColor = screen.getByRole("group", { name: "Cor da métrica 1" });
    await userEvent.click(within(seriesColor).getByRole("radio", { name: "Violeta" }));
    const hex = within(seriesColor).getByLabelText("Cor hex");
    await userEvent.clear(hex);
    await userEvent.type(hex, "#F5F5A0");
    expect(within(seriesColor).getByText(/^Pouco contraste no modo claro/)).toBeInTheDocument();
    expect(within(seriesColor).getByRole("radio", { name: "Personalizada" })).toBeChecked();

    const background = screen.getByRole("group", { name: "Fundo do card" });
    expect(within(background).getByRole("radio", { name: "Nenhuma" })).toBeChecked();
    await userEvent.click(within(background).getByRole("radio", { name: "Verde-água" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(saved().widget).toMatchObject({ background: "aqua", series: [{ color: "#f5f5a0" }] });

    await userEvent.click(within(background).getByRole("radio", { name: "Nenhuma" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect("background" in saved().widget).toBe(false);
  });

  it("keeps the color while the hex is incomplete and focuses the hex field for a custom color", async () => {
    renderEditor();
    const background = screen.getByRole("group", { name: "Fundo do card" });
    const hex = within(background).getByLabelText("Cor hex");

    await userEvent.click(within(background).getByRole("radio", { name: "Personalizada" }));
    expect(hex).toHaveFocus();
    await userEvent.type(hex, "12");
    expect(hex).toHaveAttribute("aria-invalid", "true");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect("background" in saved().widget).toBe(false);
  });

  it("shows the right hex when a series moves up after another is removed", async () => {
    renderEditor();
    await userEvent.click(screen.getByRole("button", { name: "Adicionar métrica" }));
    const first = screen.getByRole("group", { name: "Cor da métrica 1" });
    await userEvent.clear(within(first).getByLabelText("Cor hex"));
    await userEvent.paste("#ff0000");

    await userEvent.click(screen.getByRole("button", { name: "Remover métrica 1" }));

    const moved = screen.getByRole("group", { name: "Cor da métrica 1" });
    expect(within(moved).getByLabelText("Cor hex")).toHaveValue("#");
    expect(within(moved).getByRole("radio", { name: "Laranja" })).toBeChecked();
  });

  it("closes, and offers deletion only for an existing widget", async () => {
    renderEditor(DEFAULT_DASHBOARD.sections[0]!.widgets[1]!, false);
    expect(screen.getByRole("heading", { name: "Editar gráfico" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(onDelete).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("has no delete button for a new widget and closes on Escape", async () => {
    renderEditor();

    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
