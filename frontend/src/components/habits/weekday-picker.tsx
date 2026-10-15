"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { maskFromWeekdays, WEEKDAYS, weekdaysFromMask } from "@/lib/habits/weekdays";

type WeekdayPickerProps = {
  /** Bit mask: Sunday = 1 ... Saturday = 64. */
  value: number;
  onChange: (mask: number) => void;
  labelledBy: string;
  describedBy?: string;
  invalid?: boolean;
};

/** Seven toggle buttons (Dom ... Sáb) that edit the API's weekday bit mask. */
export function WeekdayPicker({
  value,
  onChange,
  labelledBy,
  describedBy,
  invalid,
}: WeekdayPickerProps) {
  return (
    <ToggleGroup
      multiple
      variant="outline"
      spacing={1}
      className="grid w-full grid-cols-7"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      value={weekdaysFromMask(value).map(String)}
      onValueChange={(selected) => onChange(maskFromWeekdays(selected.map(Number)))}
    >
      {WEEKDAYS.map(({ index, short, long }) => (
        <ToggleGroupItem
          key={index}
          value={String(index)}
          aria-label={long}
          aria-invalid={invalid ? true : undefined}
          className="h-11 min-w-0 px-0 aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 sm:h-9"
        >
          {short}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
