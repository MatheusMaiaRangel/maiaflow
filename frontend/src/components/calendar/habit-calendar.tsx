"use client";

import { ChevronLeftIcon, ChevronRightIcon, TriangleAlertIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/browser";
import { groupByDay } from "@/lib/calendar/days";
import {
  canGoToNextMonth,
  canGoToPreviousMonth,
  defaultSelection,
  gridRange,
  isDayAllowed,
  isInRange,
} from "@/lib/calendar/grid";
import { addMonths, formatMonthYear, startOfMonth, type DateOnly } from "@/lib/dates";
import {
  useOccurrences,
  useSetOccurrenceStatus,
  type Occurrence,
  type OccurrenceStatus,
} from "@/lib/habits/occurrences";
import type { ServerSeed } from "@/lib/query-seed";
import { CalendarGrid } from "./calendar-grid";
import { DayDetails } from "./day-details";

const GRID_SKELETON_HEIGHT = "h-[26rem]";

type HabitCalendarProps = {
  /** Today in Brasília, computed on the server. */
  today: DateOnly;
  /** Occurrences of the first month's grid range (see `gridRange(startOfMonth(today))`), read on the server. */
  seed: ServerSeed<Occurrence[]>;
};

/** Month calendar of habit occurrences with a detail panel for the selected day. */
export function HabitCalendar({ today, seed }: HabitCalendarProps) {
  const initialMonth = startOfMonth(today);
  const [month, setMonth] = useState(initialMonth);
  const [selected, setSelected] = useState(today);

  const range = useMemo(() => gridRange(month), [month]);
  const occurrences = useOccurrences(
    range.start,
    range.end,
    month === initialMonth ? seed : undefined,
  );
  const setStatus = useSetOccurrenceStatus();
  const byDay = useMemo(() => groupByDay(occurrences.data ?? []), [occurrences.data]);

  function goToMonth(next: DateOnly) {
    setMonth(next);
    setSelected(defaultSelection(next, today));
  }

  function selectDay(day: DateOnly) {
    if (!isDayAllowed(day, today)) return;
    setSelected(day);
    if (!isInRange(day, range)) setMonth(startOfMonth(day));
  }

  function changeStatus(occurrence: Occurrence, status: OccurrenceStatus) {
    setStatus.mutate(
      { id: occurrence.id, status },
      {
        onError: (error) =>
          toast.error(errorMessage(error, "Não foi possível atualizar o hábito. Tente novamente.")),
      },
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 aria-live="polite" className="text-lg font-semibold first-letter:uppercase">
          {formatMonthYear(month)}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Mês anterior"
            disabled={!canGoToPreviousMonth(month, today)}
            onClick={() => goToMonth(addMonths(month, -1))}
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Button
            variant="outline"
            disabled={selected === today && month === initialMonth}
            onClick={() => goToMonth(initialMonth)}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Próximo mês"
            disabled={!canGoToNextMonth(month, today)}
            onClick={() => goToMonth(addMonths(month, 1))}
          >
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>
      </div>

      {occurrences.isError && occurrences.data === undefined ? (
        <div
          role="alert"
          className="grid justify-items-start gap-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="flex items-center gap-2">
            <TriangleAlertIcon className="size-4" aria-hidden />
            {errorMessage(occurrences.error, "Não foi possível carregar o calendário.")}
          </p>
          <Button variant="outline" onClick={() => occurrences.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : occurrences.data === undefined ? (
        <Skeleton
          className={GRID_SKELETON_HEIGHT}
          role="status"
          aria-label="Carregando calendário"
        />
      ) : (
        <>
          <CalendarGrid
            month={month}
            today={today}
            selected={selected}
            byDay={byDay}
            isStale={occurrences.isPlaceholderData}
            onSelect={selectDay}
          />
          <DayDetails
            day={selected}
            today={today}
            occurrences={byDay.get(selected) ?? []}
            isLoading={occurrences.isPlaceholderData}
            onChangeStatus={changeStatus}
          />
        </>
      )}
    </div>
  );
}
