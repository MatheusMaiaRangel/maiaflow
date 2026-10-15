"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MAX_MONTH_DAY, MIN_MONTH_DAY } from "@/lib/habits/recurrence";

const MONTH_DAYS = Array.from(
  { length: MAX_MONTH_DAY - MIN_MONTH_DAY + 1 },
  (_, offset) => MIN_MONTH_DAY + offset,
);

type MonthDayPickerProps = {
  value: readonly number[];
  onChange: (days: number[]) => void;
  labelledBy: string;
  describedBy?: string;
  invalid?: boolean;
};

/** A 1-31 grid of toggle buttons. */
export function MonthDayPicker({
  value,
  onChange,
  labelledBy,
  describedBy,
  invalid,
}: MonthDayPickerProps) {
  return (
    <ToggleGroup
      multiple
      variant="outline"
      spacing={1}
      className="grid w-full grid-cols-7"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      value={value.map(String)}
      onValueChange={(selected) => onChange(selected.map(Number).sort((a, b) => a - b))}
    >
      {MONTH_DAYS.map((day) => (
        <ToggleGroupItem
          key={day}
          value={String(day)}
          aria-label={`Dia ${day}`}
          aria-invalid={invalid ? true : undefined}
          className="h-11 min-w-0 px-0 aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 sm:h-9"
        >
          {day}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
