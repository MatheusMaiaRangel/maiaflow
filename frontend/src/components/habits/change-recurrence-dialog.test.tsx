import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChangeRecurrenceDialog } from "./change-recurrence-dialog";
import { apiFail, apiOk, makeHabit, renderWithQuery } from "./test-utils";

const api = { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() };
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/api/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser")>()),
  getBrowserApi: () => api,
}));
vi.mock("sonner", () => ({ toast }));

const TODAY = "2026-10-14";
const onClose = vi.fn();

beforeEach(() => {
  for (const method of Object.values(api)) method.mockReset();
  toast.success.mockReset();
  onClose.mockReset();
});

function open(habit = makeHabit()) {
  renderWithQuery(<ChangeRecurrenceDialog habit={habit} today={TODAY} onClose={onClose} />);
}

describe("ChangeRecurrenceDialog", () => {
  it("explains when the change starts and that generated days are untouched", () => {
    open();

    const dialog = screen.getByRole("dialog", { name: "Alterar recorrência" });
    expect(dialog).toHaveTextContent("Os dias que já foram gerados não mudam.");
    expect(dialog).toHaveTextContent(
      "Vale a partir de hoje (ou de amanhã se os hábitos de hoje já foram gerados).",
    );
  });

  it("is prefilled from the current rule", () => {
    open(
      makeHabit({
        currentFrequencyType: "IntervalDays",
        currentIntervalDays: 3,
      }),
    );

    expect(screen.getByRole("combobox", { name: "Frequência" })).toHaveTextContent("A cada N dias");
    expect(screen.getByLabelText("Repetir a cada (dias)")).toHaveValue(3);
    expect(screen.getByLabelText("Aplicar a partir de (opcional)")).toHaveValue("");
  });

  it("mentions a change that is already scheduled", () => {
    open(makeHabit({ currentEffectiveFrom: "2026-11-02T00:00:00" }));

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Já existe uma mudança agendada a partir de 02/11/2026.",
    );
  });

  it("sends the new rule without a date when none is chosen", async () => {
    api.PATCH.mockResolvedValue(apiOk(makeHabit({ currentEffectiveFrom: "2026-10-15T00:00:00" })));
    open(makeHabit({ currentFrequencyType: "SpecificDaysOfWeek", currentDaysOfWeek: 42 }));

    await userEvent.click(screen.getByRole("button", { name: "Domingo" }));
    await userEvent.click(screen.getByRole("button", { name: "Alterar recorrência" }));

    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith("/api/habits/{id}/recurrence", {
        params: { path: { id: 1 } },
        body: {
          frequencyType: "SpecificDaysOfWeek",
          daysOfWeek: 43,
          daysOfMonth: [],
          lastDayOfMonth: false,
        },
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Recorrência alterada. Vale a partir de 15/10/2026.",
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("sends the chosen apply-from date as an API date-time", async () => {
    api.PATCH.mockResolvedValue(apiOk(makeHabit({ currentEffectiveFrom: "2026-11-01T00:00:00" })));
    open();

    await userEvent.type(screen.getByLabelText("Aplicar a partir de (opcional)"), "2026-11-01");
    await userEvent.click(screen.getByRole("button", { name: "Alterar recorrência" }));

    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith(
        "/api/habits/{id}/recurrence",
        expect.objectContaining({
          body: expect.objectContaining({
            frequencyType: "Daily",
            effectiveFrom: "2026-11-01T00:00:00",
          }),
        }),
      ),
    );
  });

  it("blocks an apply-from date in the past", async () => {
    open();

    await userEvent.type(screen.getByLabelText("Aplicar a partir de (opcional)"), "2026-10-01");
    await userEvent.click(screen.getByRole("button", { name: "Alterar recorrência" }));

    expect(
      await screen.findByText("A data deve ser de amanhã até 5 anos à frente."),
    ).toBeInTheDocument();
    expect(api.PATCH).not.toHaveBeenCalled();
  });

  it("requires at least one weekday for specific days", async () => {
    open(makeHabit({ currentFrequencyType: "SpecificDaysOfWeek", currentDaysOfWeek: 2 }));

    await userEvent.click(screen.getByRole("button", { name: "Segunda-feira" }));
    await userEvent.click(screen.getByRole("button", { name: "Alterar recorrência" }));

    expect(await screen.findByText("Escolha pelo menos um dia da semana.")).toBeInTheDocument();
    expect(api.PATCH).not.toHaveBeenCalled();
  });

  it("shows the API message when the change is refused", async () => {
    api.PATCH.mockResolvedValue(
      apiFail(400, { detail: "A data deve ser posterior ao último dia gerado." }),
    );
    open();

    await userEvent.click(screen.getByRole("button", { name: "Alterar recorrência" }));

    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "A data deve ser posterior ao último dia gerado.",
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
