"use client";

import { CalendarHeartIcon } from "lucide-react";
import { useId } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { disabledReasonFor } from "@/lib/calendar/days";
import { formatDateWithWeekday, type DateOnly } from "@/lib/dates";
import type { Occurrence, OccurrenceStatus } from "@/lib/habits/occurrences";
import { OccurrenceStatusControl } from "./occurrence-status-control";

const SKELETON_ROWS = [0, 1];

type DayDetailsProps = {
  day: DateOnly;
  today: DateOnly;
  occurrences: readonly Occurrence[];
  /** True while the data for this day is still loading. */
  isLoading?: boolean;
  onChangeStatus: (occurrence: Occurrence, status: OccurrenceStatus) => void;
};

/** Panel below the grid: the habits of the selected day, each with its status control. */
export function DayDetails({
  day,
  today,
  occurrences,
  isLoading,
  onChangeStatus,
}: DayDetailsProps) {
  const headingId = useId();
  const futureReason = occurrences
    .map((occurrence) => disabledReasonFor(occurrence, today))
    .find((reason) => reason !== undefined);

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={isLoading || undefined}
      className="grid gap-3 rounded-xl border p-4"
    >
      <h3 id={headingId} className="font-medium first-letter:uppercase">
        {formatDateWithWeekday(day)}
      </h3>
      {isLoading ? (
        <div className="grid gap-3" aria-label="Carregando hábitos do dia">
          {SKELETON_ROWS.map((row) => (
            <Skeleton key={row} className="h-14 w-full" />
          ))}
        </div>
      ) : occurrences.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarHeartIcon className="size-4" aria-hidden />
          Nenhum hábito neste dia. Aproveite para descansar!
        </p>
      ) : (
        <>
          {futureReason ? <p className="text-sm text-muted-foreground">{futureReason}.</p> : null}
          <ul className="grid gap-3">
            {occurrences.map((occurrence) => (
              <li
                key={occurrence.habitId}
                className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <span className="font-medium break-words">{occurrence.habitTitle}</span>
                <OccurrenceStatusControl
                  occurrence={occurrence}
                  disabledReason={disabledReasonFor(occurrence, today)}
                  showDisabledReason={false}
                  onChange={(status) => onChangeStatus(occurrence, status)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
