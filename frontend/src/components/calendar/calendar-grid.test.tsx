import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { groupByDay } from "@/lib/calendar/days";
import type { Occurrence } from "@/lib/habits/occurrences";
import { CalendarGrid } from "./calendar-grid";

const TODAY = "2026-10-14";

function occurrence(id: number, date: string, status: Occurrence["status"]): Occurrence {
  return { id, habitId: id, habitTitle: `Hábito ${id}`, date: `${date}T00:00:00`, status };
}

const byDay = groupByDay([
  occurrence(1, "2026-10-14", "Completed"),
  occurrence(2, "2026-10-14", "Pending"),
  occurrence(3, "2026-09-30", "NotCompleted"),
]);

function renderGrid(overrides: Partial<Parameters<typeof CalendarGrid>[0]> = {}) {
  const onSelect = vi.fn();
  render(
    <CalendarGrid
      month="2026-10-01"
      today={TODAY}
      selected={TODAY}
      byDay={byDay}
      onSelect={onSelect}
      {...overrides}
    />,
  );
  return { onSelect };
}

describe("CalendarGrid", () => {
  test("shows the week days starting on Sunday", () => {
    renderGrid();

    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers).toEqual(["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]);
  });

  test("shows whole weeks including days of the neighbouring months", () => {
    renderGrid();

    expect(screen.getAllByRole("gridcell")).toHaveLength(35);
    expect(screen.getByRole("button", { name: "27 de setembro, sem hábitos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "31 de outubro, sem hábitos" })).toBeInTheDocument();
  });

  test("labels each day with its habits and how many are done", () => {
    renderGrid();

    expect(
      screen.getByRole("button", { name: "14 de outubro, 2 hábitos, 1 feito" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "30 de setembro, 1 hábito, 1 não feito" }),
    ).toBeInTheDocument();
  });

  test("marks today with aria-current and the selected day with aria-selected", () => {
    renderGrid({ selected: "2026-10-20" });

    expect(screen.getByRole("button", { name: /^14 de outubro/ })).toHaveAttribute(
      "aria-current",
      "date",
    );
    expect(screen.getByRole("button", { name: /^20 de outubro/ })).not.toHaveAttribute(
      "aria-current",
    );
    const selectedCell = screen
      .getByRole("button", { name: /^20 de outubro/ })
      .closest("[role=gridcell]");
    expect(selectedCell).toHaveAttribute("aria-selected", "true");
  });

  test("shows the completed count out of the total as text", () => {
    renderGrid();

    const cell = screen.getByRole("button", { name: /^14 de outubro/ });
    expect(within(cell).getByText("1/2")).toBeInTheDocument();
  });

  test("has a single tab stop on the selected day", () => {
    renderGrid();

    const tabbable = screen.getAllByRole("button").filter((button) => button.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAccessibleName(/^14 de outubro/);
  });

  test("selects a day when it is clicked", async () => {
    const { onSelect } = renderGrid();

    await userEvent.click(screen.getByRole("button", { name: /^20 de outubro/ }));

    expect(onSelect).toHaveBeenCalledWith("2026-10-20");
  });

  test("is busy and dimmed while it shows another month's data", () => {
    renderGrid({ isStale: true });

    expect(screen.getByRole("grid")).toHaveAttribute("aria-busy", "true");
  });

  test("moves the selection and the focus with the arrow keys", async () => {
    function Harness() {
      const [selected, setSelected] = useState(TODAY);
      return (
        <CalendarGrid
          month="2026-10-01"
          today={TODAY}
          selected={selected}
          byDay={byDay}
          onSelect={setSelected}
        />
      );
    }
    render(<Harness />);

    screen.getByRole("button", { name: /^14 de outubro/ }).focus();
    await userEvent.keyboard("{ArrowRight}{ArrowDown}");

    expect(screen.getByRole("button", { name: /^22 de outubro/ })).toHaveFocus();
  });

  test("ignores keys that do not navigate", async () => {
    const { onSelect } = renderGrid();

    screen.getByRole("button", { name: /^14 de outubro/ }).focus();
    await userEvent.keyboard("a");

    expect(onSelect).not.toHaveBeenCalled();
  });
});
