import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { Occurrence } from "@/lib/habits/occurrences";
import { DayDetails } from "./day-details";

const TODAY = "2026-10-14";

function occurrence(
  id: number,
  date: string,
  status: Occurrence["status"] = "Pending",
): Occurrence {
  return { id, habitId: id || 9, habitTitle: `Hábito ${id}`, date: `${date}T00:00:00`, status };
}

function renderDetails(props: Partial<Parameters<typeof DayDetails>[0]> = {}) {
  const onChangeStatus = vi.fn();
  render(
    <DayDetails
      day={TODAY}
      today={TODAY}
      occurrences={[]}
      onChangeStatus={onChangeStatus}
      {...props}
    />,
  );
  return { onChangeStatus };
}

describe("DayDetails", () => {
  test("titles the panel with the weekday and date", () => {
    renderDetails();

    expect(
      screen.getByRole("heading", { name: "quarta-feira, 14 de outubro" }),
    ).toBeInTheDocument();
  });

  test("shows a friendly text when the day has no habits", () => {
    renderDetails();

    expect(screen.getByText(/Nenhum hábito neste dia/)).toBeInTheDocument();
  });

  test("lists each habit with its status control", () => {
    renderDetails({
      occurrences: [occurrence(1, TODAY, "Completed"), occurrence(2, TODAY)],
    });

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Hábito 1")).toBeInTheDocument();
    expect(within(items[0]).getByRole("button", { name: "Feito" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("reports which occurrence changed to which status", async () => {
    const target = occurrence(2, TODAY);
    const { onChangeStatus } = renderDetails({ occurrences: [occurrence(1, TODAY), target] });

    const second = screen.getAllByRole("listitem")[1];
    await userEvent.click(within(second).getByRole("button", { name: "Feito" }));

    expect(onChangeStatus).toHaveBeenCalledWith(target, "Completed");
  });

  test("disables the controls of future days and says why once", () => {
    renderDetails({
      day: "2026-10-16",
      occurrences: [occurrence(0, "2026-10-16"), occurrence(0, "2026-10-16")],
    });

    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(screen.getAllByText(/Ainda não chegou o dia/)).toHaveLength(1);
  });

  test("shows placeholders instead of habits while loading", () => {
    renderDetails({ isLoading: true, occurrences: [occurrence(1, TODAY)] });

    expect(screen.getByLabelText("Carregando hábitos do dia")).toBeInTheDocument();
    expect(screen.queryByText("Hábito 1")).not.toBeInTheDocument();
    expect(screen.queryByText(/Nenhum hábito/)).not.toBeInTheDocument();
  });
});
