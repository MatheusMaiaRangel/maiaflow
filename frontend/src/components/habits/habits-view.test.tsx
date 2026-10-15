import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFail, apiOk, makeHabit, renderWithQuery } from "./test-utils";
import { HabitsView } from "./habits-view";

const api = { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() };
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/api/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser")>()),
  getBrowserApi: () => api,
}));
vi.mock("sonner", () => ({ toast }));

const TODAY = "2026-10-14";
const water = makeHabit({ id: 1, title: "Beber água", description: "Dois litros por dia" });
const gym = makeHabit({
  id: 2,
  title: "Academia",
  currentFrequencyType: "SpecificDaysOfWeek",
  currentDaysOfWeek: 42,
});

function seed(habits = [water, gym]) {
  return { data: habits, fetchedAt: Date.now() };
}

beforeEach(() => {
  for (const method of Object.values(api)) method.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
  api.GET.mockResolvedValue(apiOk([]));
});

describe("HabitsView list", () => {
  it("shows each habit with its description, recurrence summary and start date", () => {
    renderWithQuery(<HabitsView seed={seed()} today={TODAY} />);

    const list = screen.getByRole("list", { name: "Seus hábitos" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Beber água")).toBeInTheDocument();
    expect(within(items[0]).getByText("Dois litros por dia")).toBeInTheDocument();
    expect(within(items[0]).getByText("Todos os dias")).toBeInTheDocument();
    expect(within(items[0]).getByText("Começou em 01/10/2026")).toBeInTheDocument();
    expect(within(items[1]).getByText("Dias da semana: seg, qua e sex")).toBeInTheDocument();
  });

  it("flags a recurrence change scheduled for the future", () => {
    const scheduled = makeHabit({ currentEffectiveFrom: "2026-11-02T00:00:00" });
    renderWithQuery(<HabitsView seed={seed([scheduled])} today={TODAY} />);

    expect(screen.getByText("A partir de 02/11/2026")).toBeInTheDocument();
  });

  it("does not flag a rule that already started", () => {
    renderWithQuery(<HabitsView seed={seed()} today={TODAY} />);

    expect(screen.queryByText(/A partir de/)).not.toBeInTheDocument();
  });

  it("shows the empty state with a way to create the first habit", () => {
    renderWithQuery(<HabitsView seed={seed([])} today={TODAY} />);

    expect(screen.getByText("Nenhum hábito ainda")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo hábito" })).toBeInTheDocument();
  });

  it("shows a loading state until the list arrives", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    api.GET.mockReturnValue(new Promise((done) => (resolve = done)));
    renderWithQuery(<HabitsView today={TODAY} />);

    expect(screen.getByRole("status", { name: "Carregando hábitos" })).toBeInTheDocument();

    resolve(apiOk([water]));
    expect(await screen.findByText("Beber água")).toBeInTheDocument();
  });

  it("shows an error with a retry button when the list fails to load", async () => {
    api.GET.mockResolvedValueOnce(apiFail(500, { detail: "Erro no servidor." }));
    renderWithQuery(<HabitsView today={TODAY} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar seus hábitos.");
    expect(alert).toHaveTextContent("Erro no servidor.");

    api.GET.mockResolvedValueOnce(apiOk([water]));
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Beber água")).toBeInTheDocument();
  });
});

describe("HabitsView create", () => {
  it("creates a daily habit starting today and shows it in the list", async () => {
    api.POST.mockResolvedValue(apiOk(makeHabit({ id: 9, title: "Meditar" }), 201));
    renderWithQuery(<HabitsView seed={seed([])} today={TODAY} />);

    await userEvent.click(screen.getByRole("button", { name: "Novo hábito" }));
    const dialog = await screen.findByRole("dialog", { name: "Novo hábito" });
    expect(within(dialog).getByLabelText("Começa em")).toHaveValue(TODAY);
    await userEvent.type(within(dialog).getByLabelText("Título"), "  Meditar ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Criar hábito" }));

    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith("/api/habits", {
        body: {
          title: "Meditar",
          startDate: "2026-10-14T00:00:00",
          frequencyType: "Daily",
          daysOfWeek: 0,
          daysOfMonth: [],
          lastDayOfMonth: false,
        },
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Hábito criado.");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  async function fillAndSubmit(title: string, frequency: string, extra: () => Promise<void>) {
    await userEvent.click(screen.getByRole("button", { name: "Novo hábito" }));
    await userEvent.type(await screen.findByLabelText("Título"), title);
    await userEvent.click(screen.getByRole("combobox", { name: "Frequência" }));
    await userEvent.click(await screen.findByRole("option", { name: frequency }));
    await extra();
    await userEvent.click(screen.getByRole("button", { name: "Criar hábito" }));
  }

  it("creates a habit on specific weekdays with the bit mask", async () => {
    api.POST.mockResolvedValue(apiOk(gym, 201));
    renderWithQuery(<HabitsView seed={seed([])} today={TODAY} />);

    await fillAndSubmit("Academia", "Dias da semana específicos", async () => {
      await userEvent.click(screen.getByRole("button", { name: "Segunda-feira" }));
      await userEvent.click(screen.getByRole("button", { name: "Quarta-feira" }));
      await userEvent.click(screen.getByRole("button", { name: "Sexta-feira" }));
    });

    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith("/api/habits", {
        body: expect.objectContaining({
          frequencyType: "SpecificDaysOfWeek",
          daysOfWeek: 42,
          daysOfMonth: [],
          lastDayOfMonth: false,
        }),
      }),
    );
  });

  it("creates a monthly habit on chosen days and the last day", async () => {
    api.POST.mockResolvedValue(apiOk(makeHabit({ id: 5 }), 201));
    renderWithQuery(<HabitsView seed={seed([])} today={TODAY} />);

    await fillAndSubmit("Pagar contas", "Todo mês", async () => {
      await userEvent.click(screen.getByRole("button", { name: "Dia 10" }));
      await userEvent.click(screen.getByRole("checkbox", { name: "Último dia do mês" }));
    });

    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith("/api/habits", {
        body: expect.objectContaining({
          frequencyType: "Monthly",
          daysOfWeek: 0,
          daysOfMonth: [10],
          lastDayOfMonth: true,
        }),
      }),
    );
  });

  it("creates a habit that repeats every few days", async () => {
    api.POST.mockResolvedValue(apiOk(makeHabit({ id: 6 }), 201));
    renderWithQuery(<HabitsView seed={seed([])} today={TODAY} />);

    await fillAndSubmit("Regar plantas", "A cada N dias", async () => {
      await userEvent.type(screen.getByLabelText("Repetir a cada (dias)"), "3");
    });

    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith("/api/habits", {
        body: expect.objectContaining({ frequencyType: "IntervalDays", intervalDays: 3 }),
      }),
    );
  });

  it("asks for the interval before creating an every-N-days habit", async () => {
    renderWithQuery(<HabitsView seed={seed([])} today={TODAY} />);

    await fillAndSubmit("Regar plantas", "A cada N dias", async () => undefined);

    expect(
      await screen.findByText("Informe um número inteiro de 1 a 3650 dias."),
    ).toBeInTheDocument();
    expect(api.POST).not.toHaveBeenCalled();
  });

  it("bases the weekly hint on the chosen start date", async () => {
    renderWithQuery(<HabitsView seed={seed([])} today={TODAY} />);

    await userEvent.click(screen.getByRole("button", { name: "Novo hábito" }));
    await userEvent.click(await screen.findByRole("combobox", { name: "Frequência" }));
    await userEvent.click(await screen.findByRole("option", { name: "Toda semana" }));
    expect(screen.getByText(/Repete toda quarta-feira/)).toBeInTheDocument();

    const start = screen.getByLabelText("Começa em");
    await userEvent.clear(start);
    await userEvent.type(start, "2026-10-17");

    expect(await screen.findByText(/Repete todo sábado/)).toBeInTheDocument();
  });

  it("shows Portuguese validation errors and does not call the API", async () => {
    renderWithQuery(<HabitsView seed={seed([])} today={TODAY} />);

    await userEvent.click(screen.getByRole("button", { name: "Novo hábito" }));
    await userEvent.type(await screen.findByLabelText("Título"), "ab");
    await userEvent.click(screen.getByRole("button", { name: "Criar hábito" }));

    expect(
      await screen.findByText("O título deve ter pelo menos 3 caracteres."),
    ).toBeInTheDocument();
    expect(api.POST).not.toHaveBeenCalled();
  });

  it("shows the server error above the form and keeps the dialog open", async () => {
    api.POST.mockResolvedValue(apiFail(400, { detail: "A data de início está fora do limite." }));
    renderWithQuery(<HabitsView seed={seed([])} today={TODAY} />);

    await userEvent.click(screen.getByRole("button", { name: "Novo hábito" }));
    await userEvent.type(await screen.findByLabelText("Título"), "Meditar");
    await userEvent.click(screen.getByRole("button", { name: "Criar hábito" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A data de início está fora do limite.",
    );
    expect(screen.getByRole("dialog", { name: "Novo hábito" })).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("puts a server field error under the field", async () => {
    api.POST.mockResolvedValue(apiFail(400, { errors: { Title: ["Título já usado."] } }));
    renderWithQuery(<HabitsView seed={seed([])} today={TODAY} />);

    await userEvent.click(screen.getByRole("button", { name: "Novo hábito" }));
    await userEvent.type(await screen.findByLabelText("Título"), "Meditar");
    await userEvent.click(screen.getByRole("button", { name: "Criar hábito" }));

    expect(await screen.findByText("Título já usado.")).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveAttribute("aria-invalid", "true");
  });

  it("closes without saving when the user cancels", async () => {
    renderWithQuery(<HabitsView seed={seed([])} today={TODAY} />);

    await userEvent.click(screen.getByRole("button", { name: "Novo hábito" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.POST).not.toHaveBeenCalled();
  });
});

describe("HabitsView edit", () => {
  it("edits title and description of a habit", async () => {
    api.PATCH.mockResolvedValue(apiOk({ ...water, title: "Beber mais água" }));
    renderWithQuery(<HabitsView seed={seed()} today={TODAY} />);

    await userEvent.click(screen.getByRole("button", { name: "Editar hábito Beber água" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar hábito" });
    expect(within(dialog).getByLabelText("Título")).toHaveValue("Beber água");
    expect(within(dialog).getByLabelText("Descrição (opcional)")).toHaveValue(
      "Dois litros por dia",
    );
    await userEvent.clear(within(dialog).getByLabelText("Título"));
    await userEvent.type(within(dialog).getByLabelText("Título"), "Beber mais água");
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith("/api/habits/{id}", {
        params: { path: { id: 1 } },
        body: { title: "Beber mais água", description: "Dois litros por dia" },
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Hábito atualizado.");
  });

  it("clears the description by sending null when it is emptied", async () => {
    api.PATCH.mockResolvedValue(apiOk({ ...water, description: null }));
    renderWithQuery(<HabitsView seed={seed()} today={TODAY} />);

    await userEvent.click(screen.getByRole("button", { name: "Editar hábito Beber água" }));
    await userEvent.clear(await screen.findByLabelText("Descrição (opcional)"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith("/api/habits/{id}", {
        params: { path: { id: 1 } },
        body: { title: "Beber água", description: null },
      }),
    );
  });

  it("shows the server error when saving fails", async () => {
    api.PATCH.mockResolvedValue(apiFail(404, { detail: "Hábito não encontrado." }));
    renderWithQuery(<HabitsView seed={seed()} today={TODAY} />);

    await userEvent.click(screen.getByRole("button", { name: "Editar hábito Beber água" }));
    await userEvent.click(await screen.findByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Hábito não encontrado.");
  });
});

describe("HabitsView delete", () => {
  it("warns that the history is deleted too and deletes after confirming", async () => {
    api.DELETE.mockResolvedValue({ response: { ok: true, status: 204 } });
    renderWithQuery(<HabitsView seed={seed()} today={TODAY} />);

    await userEvent.click(screen.getByRole("button", { name: "Excluir hábito Beber água" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("todo o histórico");
    expect(api.DELETE).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(api.DELETE).toHaveBeenCalledWith("/api/habits/{id}", { params: { path: { id: 1 } } }),
    );
    expect(toast.success).toHaveBeenCalledWith("Hábito excluído.");
    await waitFor(() => expect(screen.queryByText("Beber água")).not.toBeInTheDocument());
  });

  it("does not delete when the user cancels", async () => {
    renderWithQuery(<HabitsView seed={seed()} today={TODAY} />);

    await userEvent.click(screen.getByRole("button", { name: "Excluir hábito Beber água" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(api.DELETE).not.toHaveBeenCalled();
    expect(screen.getByText("Beber água")).toBeInTheDocument();
  });

  it("tells the user when the deletion fails and keeps the habit", async () => {
    api.DELETE.mockResolvedValue(apiFail(500, { detail: "Erro no servidor." }));
    api.GET.mockResolvedValue(apiOk([water, gym]));
    renderWithQuery(<HabitsView seed={seed()} today={TODAY} />);

    await userEvent.click(screen.getByRole("button", { name: "Excluir hábito Beber água" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro no servidor."));
    expect(screen.getByText("Beber água")).toBeInTheDocument();
  });
});
