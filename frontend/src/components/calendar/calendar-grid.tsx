"use client";

import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { buildWeeks, isInMonth, moveSelection } from "@/lib/calendar/grid";
import { dayAriaLabel, summarize, type OccurrencesByDay } from "@/lib/calendar/days";
import { parseDateOnly, weekdayName, type DateOnly } from "@/lib/dates";
import type { Occurrence, OccurrenceStatus } from "@/lib/habits/occurrences";
import { statusMeta } from "./status-meta";

const WEEKDAY_HEADERS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_DOTS = 4;
const DAY_ATTRIBUTE = "data-day";

type CalendarGridProps = {
  /** Any day of the month to show (the grid also shows days of the neighbouring months). */
  month: DateOnly;
  today: DateOnly;
  selected: DateOnly;
  byDay: OccurrencesByDay;
  /** True while the data of another month is still on screen. */
  isStale?: boolean;
  onSelect: (day: DateOnly) => void;
};

/**
 * Month grid. One tab stop (the selected day); arrow keys, Home/End and PageUp/PageDown move the
 * selection. Each day is a button labelled like "14 de outubro, 2 hábitos, 1 feito".
 */
export function CalendarGrid({
  month,
  today,
  selected,
  byDay,
  isStale,
  onSelect,
}: CalendarGridProps) {
  const weeks = useMemo(() => buildWeeks(month), [month]);
  const gridRef = useRef<HTMLDivElement>(null);
  const shouldFocusSelected = useRef(false);

  useEffect(() => {
    if (!shouldFocusSelected.current) return;
    shouldFocusSelected.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[${DAY_ATTRIBUTE}="${selected}"]`)?.focus();
  }, [selected, month]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = (event.target as HTMLElement).getAttribute(DAY_ATTRIBUTE);
    if (!current) return;
    const next = moveSelection(current, event.key);
    if (!next) return;
    event.preventDefault();
    shouldFocusSelected.current = true;
    onSelect(next);
  }

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label="Calendário de hábitos"
      aria-busy={isStale || undefined}
      onKeyDown={handleKeyDown}
      className={cn("grid gap-1", isStale && "opacity-60")}
    >
      <div role="row" className="grid grid-cols-7 gap-1">
        {WEEKDAY_HEADERS.map((header, index) => (
          <div
            key={header}
            role="columnheader"
            aria-label={weekdayName(index)}
            className="py-1 text-center text-xs font-medium text-muted-foreground"
          >
            {header}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} role="row" className="grid grid-cols-7 gap-1">
          {week.map((day) => (
            <DayCell
              key={day}
              day={day}
              isOutsideMonth={!isInMonth(day, month)}
              isToday={day === today}
              isSelected={day === selected}
              occurrences={byDay.get(day) ?? []}
              onSelect={onSelect}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

type DayCellProps = {
  day: DateOnly;
  isOutsideMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  occurrences: readonly Occurrence[];
  onSelect: (day: DateOnly) => void;
};

function DayCell({
  day,
  isOutsideMonth,
  isToday,
  isSelected,
  occurrences,
  onSelect,
}: DayCellProps) {
  const summary = summarize(occurrences);
  return (
    <div role="gridcell" aria-selected={isSelected} className="min-w-0">
      <button
        type="button"
        {...{ [DAY_ATTRIBUTE]: day }}
        aria-label={dayAriaLabel(day, summary)}
        aria-current={isToday ? "date" : undefined}
        tabIndex={isSelected ? 0 : -1}
        onClick={() => onSelect(day)}
        className={cn(
          "flex h-14 w-full flex-col items-center justify-between rounded-lg border p-1 text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-20 sm:items-start sm:p-1.5",
          isOutsideMonth && "text-muted-foreground opacity-60",
          isSelected ? "border-primary bg-muted ring-2 ring-primary" : "border-border",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs font-medium",
            isToday && "bg-primary text-primary-foreground",
          )}
        >
          {parseDateOnly(day).day}
        </span>
        {summary.total > 0 ? (
          <span aria-hidden className="flex flex-col items-center gap-0.5 sm:items-start">
            <span className="flex gap-0.5">
              {occurrences.slice(0, MAX_DOTS).map((occurrence) => (
                <StatusDot key={occurrence.habitId} status={occurrence.status} />
              ))}
            </span>
            <span className="text-[0.65rem] leading-none text-muted-foreground">
              {summary.completed}/{summary.total}
            </span>
          </span>
        ) : null}
      </button>
    </div>
  );
}

function StatusDot({ status }: { status: OccurrenceStatus }) {
  return <span className={cn("size-2 rounded-full", statusMeta(status).dotClass)} />;
}
