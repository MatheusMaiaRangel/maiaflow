"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import type { Occurrence, OccurrenceStatus } from "@/lib/habits/occurrences";
import { cn } from "@/lib/utils";
import { STATUS_OPTIONS } from "./status-meta";

export type OccurrenceStatusControlProps = {
  /** The habit occurrence shown: `habitTitle` names the group for screen readers, `status` is selected. */
  occurrence: Pick<Occurrence, "habitTitle" | "status">;
  /** When set, all options are disabled and this text explains why (e.g. "Ainda não chegou o dia"). */
  disabledReason?: string;
  /** Show `disabledReason` under the options. Pass `false` when the screen already explains it once. */
  showDisabledReason?: boolean;
  /** Called with the chosen status; not called for the status that is already selected. */
  onChange: (status: OccurrenceStatus) => void;
  className?: string;
};

/**
 * Three-option segmented control (Feito / Não feito / Pendente) for one habit occurrence. Each option is
 * a button with `aria-pressed`, shows an icon and text, and is keyboard operable.
 */
export function OccurrenceStatusControl({
  occurrence,
  disabledReason,
  showDisabledReason = true,
  onChange,
  className,
}: OccurrenceStatusControlProps) {
  const reasonId = useId();
  const isDisabled = disabledReason !== undefined;

  return (
    <div className={cn("grid gap-1", className)}>
      <div
        role="group"
        aria-label={`Status de ${occurrence.habitTitle}`}
        aria-describedby={isDisabled && showDisabledReason ? reasonId : undefined}
        className="flex flex-wrap gap-1"
      >
        {STATUS_OPTIONS.map(({ status, label, icon: Icon, activeClass }) => {
          const isSelected = occurrence.status === status;
          return (
            <Button
              key={status}
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={isSelected}
              disabled={isDisabled}
              className={cn("min-h-9 flex-1 sm:min-h-7 sm:flex-none", isSelected && activeClass)}
              onClick={() => {
                if (!isSelected) onChange(status);
              }}
            >
              <Icon aria-hidden />
              {label}
            </Button>
          );
        })}
      </div>
      {isDisabled && showDisabledReason ? (
        <p id={reasonId} className="text-xs text-muted-foreground">
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}
