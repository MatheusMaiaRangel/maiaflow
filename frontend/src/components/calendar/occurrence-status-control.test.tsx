import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { OccurrenceStatusControl } from "./occurrence-status-control";
import { statusMeta } from "./status-meta";

const occurrence = { habitTitle: "Beber água", status: "Pending" as const };

describe("OccurrenceStatusControl", () => {
  test("offers the three options in a group named after the habit", () => {
    render(<OccurrenceStatusControl occurrence={occurrence} onChange={vi.fn()} />);

    const group = screen.getByRole("group", { name: "Status de Beber água" });
    expect(group).toBeInTheDocument();
    for (const label of ["Feito", "Não feito", "Pendente"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  test("marks only the current status as pressed", () => {
    render(
      <OccurrenceStatusControl
        occurrence={{ ...occurrence, status: "Completed" }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Feito" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Não feito" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Pendente" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("reports the chosen status", async () => {
    const onChange = vi.fn();
    render(<OccurrenceStatusControl occurrence={occurrence} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Não feito" }));

    expect(onChange).toHaveBeenCalledWith("NotCompleted");
  });

  test("does not report the status that is already selected", async () => {
    const onChange = vi.fn();
    render(<OccurrenceStatusControl occurrence={occurrence} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Pendente" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  test("disables every option and explains why", async () => {
    const onChange = vi.fn();
    render(
      <OccurrenceStatusControl
        occurrence={occurrence}
        disabledReason="Ainda não chegou o dia"
        onChange={onChange}
      />,
    );

    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(screen.getByText("Ainda não chegou o dia")).toBeInTheDocument();
    expect(screen.getByRole("group")).toHaveAccessibleDescription("Ainda não chegou o dia");
    await userEvent.click(screen.getByRole("button", { name: "Feito" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  test("can hide the reason text when the screen explains it elsewhere", () => {
    render(
      <OccurrenceStatusControl
        occurrence={occurrence}
        disabledReason="Ainda não chegou o dia"
        showDisabledReason={false}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByText("Ainda não chegou o dia")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Feito" })).toBeDisabled();
  });
});

describe("statusMeta", () => {
  test("returns the label of each status", () => {
    expect(statusMeta("Completed").label).toBe("Feito");
    expect(statusMeta("NotCompleted").label).toBe("Não feito");
    expect(statusMeta("Pending").label).toBe("Pendente");
  });
});
