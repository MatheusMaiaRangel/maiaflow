"use client";

import { GripVerticalIcon, MoveDiagonal2Icon, PencilIcon, Trash2Icon } from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent, type Ref } from "react";
import ReactGridLayout, { useContainerWidth, type Layout } from "react-grid-layout";
import { WidgetCard } from "@/components/widgets/widget-card";
import { Button } from "@/components/ui/button";
import type { DateOnly } from "@/lib/dates";
import {
  GRID_COLUMNS,
  MAX_ROW,
  MAX_ROWS_PER_WIDGET,
  type DashboardSection,
  type WidgetConfig,
} from "@/lib/widgets/config";
import { widgetState, type DashboardSources } from "@/lib/widgets/data";
import { gridItems, moveWidget, resizeWidget, withGridItems } from "@/lib/widgets/layout";
import { cn } from "@/lib/utils";

/**
 * Close to the read-only dashboard: a two-row chart card is 540 px there (16 px gaps), so the edit grid
 * shows it the same size.
 */
export const ROW_HEIGHT = 262;
export const GRID_GAP = 16;
/** Card padding, header, legend and the "Ver os números" line around the chart. */
const CARD_CHROME = 130;
export const DRAG_HANDLE_CLASS = "dashboard-drag-handle";

export function chartHeightFor(rows: number): number {
  return rows * ROW_HEIGHT + (rows - 1) * GRID_GAP - CARD_CHROME;
}

/** "No prazo: coluna 3, linha 1, 1 de largura por 2 de altura." */
export function describePlace(widget: WidgetConfig): string {
  const { x, y, w, h } = widget.layout;
  return `${widget.title}: coluna ${x + 1}, linha ${y + 1}, ${w} de largura por ${h} de altura.`;
}

const ARROWS: Readonly<Record<string, [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

type Grab = { id: string; draft: DashboardSection };

type SectionGridProps = {
  section: DashboardSection;
  sources: DashboardSources;
  today: DateOnly;
  /** `false` when the change was refused; the grid then goes back to the stored layout. */
  onChange: (section: DashboardSection) => boolean;
  onEdit: (widget: WidgetConfig) => void;
  onDelete: (widget: WidgetConfig) => void;
  announce: (message: string) => void;
};

function ResizeHandle({ handleRef }: { handleRef: Ref<HTMLElement> }) {
  return (
    <span
      ref={handleRef as Ref<HTMLSpanElement>}
      aria-hidden
      className="react-resizable-handle grid size-6 place-items-center rounded-tl-md text-muted-foreground hover:text-foreground"
    >
      <MoveDiagonal2Icon className="size-4" />
    </span>
  );
}

/**
 * A section of the dashboard in edit mode on wide screens (D29): drag a card by its handle, resize it by
 * the corner, or focus it and use the keyboard (Enter picks it up, arrows move, Shift + arrows resize,
 * Enter drops, Esc cancels). Changes are handed to `onChange` when dropped.
 */
export function SectionGrid({
  section,
  sources,
  today,
  onChange,
  onEdit,
  onDelete,
  announce,
}: SectionGridProps) {
  const instructionsId = useId();
  const { width, containerRef, mounted } = useContainerWidth();
  const [grab, setGrab] = useState<Grab | null>(null);
  const shown = grab?.draft ?? section;
  const layout = useMemo(() => gridItems(shown), [shown]);

  // The grid keeps its own copy of a dropped layout; remounting it shows the stored one again.
  const [gridKey, setGridKey] = useState(0);

  function drop(items: Layout) {
    const next = withGridItems(section, items);
    if (next !== section && !onChange(next)) setGridKey((key) => key + 1);
  }

  function widgetIn(target: DashboardSection, id: string): WidgetConfig | undefined {
    return target.widgets.find((widget) => widget.id === id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>, widget: WidgetConfig) {
    if (event.target !== event.currentTarget) return;
    const arrow = ARROWS[event.key];

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!grab) {
        setGrab({ id: widget.id, draft: section });
        announce(
          `${widget.title} selecionado. Use as setas para mover, Shift e setas para mudar o tamanho, Enter para soltar e Esc para cancelar.`,
        );
        return;
      }
      setGrab(null);
      const placed = widgetIn(grab.draft, grab.id);
      if (grab.draft !== section) onChange(grab.draft);
      if (placed) announce(`Solto. ${describePlace(placed)}`);
    } else if (event.key === "Escape" && grab) {
      event.preventDefault();
      setGrab(null);
      announce(`Cancelado. ${describePlace(widgetIn(section, widget.id) ?? widget)}`);
    } else if (arrow && grab?.id === widget.id) {
      event.preventDefault();
      const [dx, dy] = arrow;
      const draft = event.shiftKey
        ? resizeWidget(grab.draft, widget.id, dx, dy)
        : moveWidget(grab.draft, widget.id, dx, dy);
      const moved = widgetIn(draft, widget.id);
      if (!moved || draft.widgets.some(({ layout }) => layout.y > MAX_ROW)) {
        announce("Não dá para ir mais longe.");
        return;
      }
      setGrab({ id: widget.id, draft });
      announce(describePlace(moved));
    }
  }

  return (
    <div ref={containerRef as Ref<HTMLDivElement>} className="min-w-0">
      <p id={instructionsId} className="sr-only">
        Arraste pela alça ou pelo canto. Pelo teclado: Enter para pegar, setas para mover, Shift e
        setas para mudar o tamanho, Enter para soltar, Esc para cancelar.
      </p>
      {mounted ? (
        <ReactGridLayout
          key={gridKey}
          layout={layout}
          width={width}
          gridConfig={{
            cols: GRID_COLUMNS,
            rowHeight: ROW_HEIGHT,
            margin: [GRID_GAP, GRID_GAP],
            containerPadding: [0, 0],
            maxRows: MAX_ROW + MAX_ROWS_PER_WIDGET,
          }}
          dragConfig={{ enabled: grab === null, handle: `.${DRAG_HANDLE_CLASS}` }}
          resizeConfig={{
            enabled: grab === null,
            handles: ["se"],
            handleComponent: (_, ref) => <ResizeHandle handleRef={ref} />,
          }}
          onDragStop={drop}
          onResizeStop={drop}
        >
          {shown.widgets.map((widget) => (
            <div key={widget.id}>
              <div
                tabIndex={0}
                role="group"
                aria-roledescription="gráfico móvel"
                aria-label={describePlace(widget)}
                aria-describedby={instructionsId}
                onKeyDown={(event) => onKeyDown(event, widget)}
                onBlur={(event) => {
                  // Leaving the card itself, even for one of its buttons, puts the widget back.
                  if (grab?.id === widget.id && event.target === event.currentTarget) {
                    setGrab(null);
                    announce(`Cancelado. ${describePlace(widgetIn(section, widget.id) ?? widget)}`);
                  }
                }}
                className={cn(
                  "h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  grab?.id === widget.id && "ring-3 ring-primary",
                )}
              >
                <WidgetCard
                  widget={widget}
                  state={widgetState(widget, sources, today)}
                  chartHeight={chartHeightFor(widget.layout.h)}
                  leading={
                    <span
                      aria-hidden
                      className={cn(
                        DRAG_HANDLE_CLASS,
                        "-ml-1 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing",
                      )}
                    >
                      <GripVerticalIcon className="size-4" />
                    </span>
                  }
                  actions={
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${widget.title}`}
                        onClick={() => onEdit(widget)}
                      >
                        <PencilIcon aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Excluir ${widget.title}`}
                        onClick={() => onDelete(widget)}
                      >
                        <Trash2Icon aria-hidden />
                      </Button>
                    </>
                  }
                />
              </div>
            </div>
          ))}
        </ReactGridLayout>
      ) : null}
    </div>
  );
}
