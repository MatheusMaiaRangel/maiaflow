import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_RECURRENCE, type RecurrenceValues } from "@/lib/habits/recurrence";
import { RecurrenceFields, type RecurrenceErrors } from "./recurrence-fields";

const onChangeSpy = vi.fn();

function Harness({
  initial = DEFAULT_RECURRENCE,
  anchorDate = "2026-10-14",
  errors,
}: {
  initial?: RecurrenceValues;
  anchorDate?: string | null;
  errors?: RecurrenceErrors;
}) {
  const [value, setValue] = useState(initial);
  return (
    <RecurrenceFields
      value={value}
      onChange={(next) => {
        onChangeSpy(next);
        setValue(next);
      }}
      anchorDate={anchorDate}
      errors={errors}
    />
  );
}

async function chooseFrequency(label: string) {
  await userEvent.click(screen.getByRole("combobox", { name: "Frequência" }));
  await userEvent.click(await screen.findByRole("option", { name: label }));
}

describe("RecurrenceFields", () => {
  it("shows only the frequency select for a daily habit", () => {
    render(<Harness />);

    expect(screen.getByRole("combobox", { name: "Frequência" })).toHaveTextContent("Todos os dias");
    expect(screen.queryByLabelText("Repetir a cada (dias)")).not.toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("asks for the interval when the type is every N days", async () => {
    render(<Harness />);

    await chooseFrequency("A cada N dias");
    await userEvent.type(screen.getByLabelText("Repetir a cada (dias)"), "3");

    expect(onChangeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ frequencyType: "IntervalDays", intervalDays: "3" }),
    );
  });

  it("toggles weekdays as pressed buttons and builds the bit mask", async () => {
    render(<Harness />);

    await chooseFrequency("Dias da semana específicos");
    const group = screen.getByRole("group", { name: "Dias da semana" });
    expect(group).toBeInTheDocument();
    for (const day of ["Segunda-feira", "Quarta-feira", "Sexta-feira"]) {
      await userEvent.click(screen.getByRole("button", { name: day }));
    }

    expect(onChangeSpy).toHaveBeenLastCalledWith(expect.objectContaining({ daysOfWeek: 42 }));
    expect(screen.getByRole("button", { name: "Quarta-feira" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Terça-feira" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await userEvent.click(screen.getByRole("button", { name: "Quarta-feira" }));
    expect(onChangeSpy).toHaveBeenLastCalledWith(expect.objectContaining({ daysOfWeek: 34 }));
  });

  it("picks days of the month and the last day, with a hint about short months", async () => {
    render(<Harness />);

    await chooseFrequency("Todo mês");
    await userEvent.click(screen.getByRole("button", { name: "Dia 31" }));
    await userEvent.click(screen.getByRole("button", { name: "Dia 5" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Último dia do mês" }));

    expect(screen.getByRole("group", { name: "Dias do mês" })).toBeInTheDocument();
    expect(onChangeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ daysOfMonth: [5, 31], lastDayOfMonth: true }),
    );
    expect(screen.getByText(/como 31 em abril/)).toBeInTheDocument();
  });

  it("explains what weekly and yearly habits repeat on", async () => {
    render(<Harness />);

    await chooseFrequency("Toda semana");
    expect(screen.getByText(/Repete toda quarta-feira/)).toBeInTheDocument();

    await chooseFrequency("Todo ano");
    expect(screen.getByText(/Repete todo ano em 14 de outubro/)).toBeInTheDocument();
  });

  it("uses a generic hint when the start of the rule is not known", async () => {
    render(<Harness anchorDate={null} />);

    await chooseFrequency("Toda semana");

    expect(screen.getByText(/mesmo dia da semana em que a mudança começar/)).toBeInTheDocument();
  });

  it("shows validation errors next to the right inputs", async () => {
    render(
      <Harness
        initial={{ ...DEFAULT_RECURRENCE, frequencyType: "SpecificDaysOfWeek" }}
        errors={{ daysOfWeek: "Escolha pelo menos um dia da semana." }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Escolha pelo menos um dia da semana.");
  });

  it("shows the interval and month errors", () => {
    const { rerender } = render(
      <Harness
        initial={{ ...DEFAULT_RECURRENCE, frequencyType: "IntervalDays" }}
        errors={{ intervalDays: "Intervalo inválido." }}
      />,
    );
    expect(screen.getByLabelText("Repetir a cada (dias)")).toHaveAttribute("aria-invalid", "true");

    rerender(
      <Harness
        key="monthly"
        initial={{ ...DEFAULT_RECURRENCE, frequencyType: "Monthly" }}
        errors={{ daysOfMonth: "Escolha um dia." }}
      />,
    );
    expect(screen.getByText("Escolha um dia.")).toBeInTheDocument();
  });
});
