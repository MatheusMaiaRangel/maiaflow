import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardSection } from "@/lib/widgets/config";
import { DEFAULT_DASHBOARD } from "@/lib/widgets/default-dashboard";
import type { DashboardSources } from "@/lib/widgets/data";
import { SectionGrid } from "./section-grid";
import { SectionList } from "./section-list";

type Item = { i: string; x: number; y: number; w: number; h: number };
type GridProps = {
  children: ReactNode;
  onDragStop?: (layout: Item[]) => void;
  onResizeStop?: (layout: Item[]) => void;
};

/** Stands in for react-grid-layout: a drag in jsdom cannot be simulated, so the test drops a layout itself. */
const drops = vi.hoisted(() => ({ layout: [] as Item[] }));
vi.mock("react-grid-layout", () => ({
  default: ({ children, onDragStop, onResizeStop }: GridProps) => (
    <div>
      <button type="button" onClick={() => onDragStop?.(drops.layout)}>
        drop
      </button>
      <button type="button" onClick={() => onResizeStop?.(drops.layout)}>
        resize
      </button>
      {children}
    </div>
  ),
  useContainerWidth: () => ({ width: 1000, containerRef: { current: null }, mounted: true }),
}));

const tasks: DashboardSection = DEFAULT_DASHBOARD.sections[0]!;
const sources: DashboardSources = {
  tasks: { data: [], isError: false, refetch: () => {} },
  occurrences: { data: [], isError: false, refetch: () => {} },
};
const onChange = vi.fn();
const noop = () => {};

function items(section: DashboardSection): Item[] {
  return section.widgets.map(({ id, layout }) => ({ i: id, ...layout }));
}

beforeEach(() => onChange.mockReset());

describe("SectionGrid drops", () => {
  function renderGrid() {
    render(
      <SectionGrid
        section={tasks}
        sources={sources}
        today="2026-10-14"
        onChange={onChange}
        onEdit={noop}
        onDelete={noop}
        announce={noop}
      />,
    );
  }

  it("saves the layout a drag or resize ends with", async () => {
    renderGrid();
    drops.layout = items(tasks).map((item) =>
      item.i === "tasks-on-time" ? { ...item, x: 0, y: 2 } : item,
    );

    await userEvent.click(screen.getByRole("button", { name: "drop" }));
    await userEvent.click(screen.getByRole("button", { name: "resize" }));

    expect(onChange).toHaveBeenCalledTimes(2);
    const saved = onChange.mock.calls[0]![0] as DashboardSection;
    expect(saved.widgets.find(({ id }) => id === "tasks-on-time")?.layout).toMatchObject({
      x: 0,
      y: 2,
    });
  });

  it("puts the grid back when the dropped layout is refused", async () => {
    onChange.mockReturnValue(false);
    renderGrid();
    drops.layout = items(tasks).map((item) =>
      item.i === "tasks-on-time" ? { ...item, y: 60 } : item,
    );
    const before = screen.getByRole("button", { name: "drop" });

    await userEvent.click(before);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(before).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "drop" })).toBeInTheDocument();
  });

  it("does not save a drop that changed nothing", async () => {
    renderGrid();
    drops.layout = items(tasks);

    await userEvent.click(screen.getByRole("button", { name: "drop" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("SectionList drops", () => {
  function renderList() {
    render(
      <SectionList
        section={tasks}
        onChange={onChange}
        onEdit={noop}
        onDelete={noop}
        announce={noop}
      />,
    );
  }

  it("re-packs the section in the order the rows were dropped in", async () => {
    renderList();
    // The last row dragged to the top.
    drops.layout = [
      { i: "tasks-next-7-days", x: 0, y: 0, w: 1, h: 1 },
      { i: "tasks-per-day", x: 0, y: 1, w: 1, h: 1 },
      { i: "tasks-on-time", x: 0, y: 2, w: 1, h: 1 },
      { i: "tasks-status", x: 0, y: 3, w: 1, h: 1 },
    ];

    await userEvent.click(screen.getByRole("button", { name: "drop" }));

    const saved = onChange.mock.calls[0]![0] as DashboardSection;
    expect(saved.widgets.find(({ id }) => id === "tasks-next-7-days")?.layout).toMatchObject({
      x: 0,
      y: 0,
    });
  });

  it("ignores a drop that kept the order, and the ends of the list", async () => {
    renderList();
    drops.layout = [
      { i: "tasks-per-day", x: 0, y: 0, w: 1, h: 1 },
      { i: "tasks-on-time", x: 0, y: 1, w: 1, h: 1 },
      { i: "tasks-status", x: 0, y: 2, w: 1, h: 1 },
      { i: "tasks-next-7-days", x: 0, y: 3, w: 1, h: 1 },
    ];

    await userEvent.click(screen.getByRole("button", { name: "drop" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Subir Concluídas por dia" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "Descer Próximos 7 dias" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
