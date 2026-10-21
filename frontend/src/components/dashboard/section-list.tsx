"use client";

import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { type Ref } from "react";
import ReactGridLayout, { useContainerWidth, type Layout } from "react-grid-layout";
import { Button } from "@/components/ui/button";
import type { DashboardSection, WidgetConfig } from "@/lib/widgets/config";
import { CHART_LABELS } from "@/lib/widgets/labels";
import { packInOrder, readingOrder, reorderWidget } from "@/lib/widgets/layout";
import { cn } from "@/lib/utils";

const ITEM_HEIGHT = 56;
const ITEM_GAP = 8;
const HANDLE_CLASS = "dashboard-list-handle";

type SectionListProps = {
  section: DashboardSection;
  onChange: (section: DashboardSection) => boolean;
  onEdit: (widget: WidgetConfig) => void;
  onDelete: (widget: WidgetConfig) => void;
  announce: (message: string) => void;
};

/**
 * A section in edit mode on narrow screens (D30): one compact row per widget, in reading order. Rows are
 * reordered by dragging the handle or with the arrow buttons; the section's wide layout is re-packed in
 * the new order. The buttons at the ends stay focusable (`aria-disabled`), so focus is not lost when a
 * widget reaches the top or the bottom.
 */
export function SectionList({ section, onChange, onEdit, onDelete, announce }: SectionListProps) {
  const { width, containerRef, mounted } = useContainerWidth();
  const ordered = readingOrder(section);
  const layout = ordered.map(({ id }, index) => ({ i: id, x: 0, y: index, w: 1, h: 1 }));

  function move(widget: WidgetConfig, delta: number) {
    const next = reorderWidget(section, widget.id, delta);
    if (next === section) return;
    onChange(next);
    const place = readingOrder(next).findIndex(({ id }) => id === widget.id) + 1;
    announce(`${widget.title}: posição ${place} de ${ordered.length}.`);
  }

  function drop(items: Layout) {
    const order = items.toSorted((a, b) => a.y - b.y).map(({ i }) => i);
    if (order.every((id, index) => id === ordered[index]?.id)) return;
    onChange(packInOrder(section, order));
  }

  return (
    <div ref={containerRef as Ref<HTMLDivElement>} className="min-w-0">
      {mounted ? (
        <ReactGridLayout
          layout={layout}
          width={width}
          gridConfig={{
            cols: 1,
            rowHeight: ITEM_HEIGHT,
            margin: [ITEM_GAP, ITEM_GAP],
            containerPadding: [0, 0],
          }}
          dragConfig={{ enabled: true, handle: `.${HANDLE_CLASS}` }}
          resizeConfig={{ enabled: false }}
          onDragStop={drop}
        >
          {ordered.map((widget, index) => (
            <div key={widget.id}>
              <div className="flex h-full items-center gap-1 rounded-xl border bg-card px-2">
                <span
                  aria-hidden
                  className={cn(
                    HANDLE_CLASS,
                    "grid size-10 shrink-0 cursor-grab touch-none place-items-center text-muted-foreground",
                  )}
                >
                  <GripVerticalIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{widget.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {CHART_LABELS[widget.chart]}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Subir ${widget.title}`}
                  aria-disabled={index === 0}
                  onClick={() => move(widget, -1)}
                  className="aria-disabled:opacity-50"
                >
                  <ArrowUpIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Descer ${widget.title}`}
                  aria-disabled={index === ordered.length - 1}
                  onClick={() => move(widget, 1)}
                  className="aria-disabled:opacity-50"
                >
                  <ArrowDownIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${widget.title}`}
                  onClick={() => onEdit(widget)}
                >
                  <PencilIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Excluir ${widget.title}`}
                  onClick={() => onDelete(widget)}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </ReactGridLayout>
      ) : null}
    </div>
  );
}
