"use client";

import { useId } from "react";
import { TextField } from "@/components/form/text-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DateOnly } from "@/lib/dates";
import {
  anchorHint,
  FREQUENCY_LABELS,
  FREQUENCY_TYPES,
  MAX_INTERVAL_DAYS,
  MIN_INTERVAL_DAYS,
  type FrequencyType,
  type RecurrenceValues,
} from "@/lib/habits/recurrence";
import { MonthDayPicker } from "./month-day-picker";
import { WeekdayPicker } from "./weekday-picker";

export type RecurrenceErrors = {
  intervalDays?: string;
  daysOfWeek?: string;
  daysOfMonth?: string;
};

type RecurrenceFieldsProps = {
  value: RecurrenceValues;
  onChange: (next: RecurrenceValues) => void;
  /** Day the rule starts, for the weekly/yearly hint. `null` when it is not known yet. */
  anchorDate: DateOnly | null;
  errors?: RecurrenceErrors;
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

/** Frequency select plus the inputs the chosen type needs. Controlled: the form owns the values. */
export function RecurrenceFields({
  value,
  onChange,
  anchorDate,
  errors = {},
}: RecurrenceFieldsProps) {
  const baseId = useId();
  const frequencyId = `${baseId}-frequency`;
  const weekdaysLabelId = `${baseId}-weekdays-label`;
  const weekdaysErrorId = `${baseId}-weekdays-error`;
  const monthDaysLabelId = `${baseId}-month-days-label`;
  const monthDaysErrorId = `${baseId}-month-days-error`;
  const hint = anchorHint(value.frequencyType, anchorDate);

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={frequencyId}>Frequência</Label>
        <Select
          items={FREQUENCY_LABELS}
          value={value.frequencyType}
          onValueChange={(next) => {
            if (next) onChange({ ...value, frequencyType: next as FrequencyType });
          }}
        >
          <SelectTrigger id={frequencyId} className="h-11 w-full sm:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {FREQUENCY_TYPES.map((type) => (
              <SelectItem key={type} value={type} className="min-h-9">
                {FREQUENCY_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>

      {value.frequencyType === "IntervalDays" ? (
        <TextField
          label="Repetir a cada (dias)"
          type="number"
          inputMode="numeric"
          min={MIN_INTERVAL_DAYS}
          max={MAX_INTERVAL_DAYS}
          step={1}
          className="h-11 sm:h-9"
          value={value.intervalDays}
          onChange={(event) => onChange({ ...value, intervalDays: event.target.value })}
          error={errors.intervalDays}
        />
      ) : null}

      {value.frequencyType === "SpecificDaysOfWeek" ? (
        <div className="grid gap-2">
          <p id={weekdaysLabelId} className="text-sm leading-none font-medium">
            Dias da semana
          </p>
          <WeekdayPicker
            value={value.daysOfWeek}
            onChange={(daysOfWeek) => onChange({ ...value, daysOfWeek })}
            labelledBy={weekdaysLabelId}
            describedBy={errors.daysOfWeek ? weekdaysErrorId : undefined}
            invalid={Boolean(errors.daysOfWeek)}
          />
          <FieldError id={weekdaysErrorId} message={errors.daysOfWeek} />
        </div>
      ) : null}

      {value.frequencyType === "Monthly" ? (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <p id={monthDaysLabelId} className="text-sm leading-none font-medium">
              Dias do mês
            </p>
            <MonthDayPicker
              value={value.daysOfMonth}
              onChange={(daysOfMonth) => onChange({ ...value, daysOfMonth })}
              labelledBy={monthDaysLabelId}
              describedBy={errors.daysOfMonth ? monthDaysErrorId : undefined}
              invalid={Boolean(errors.daysOfMonth)}
            />
            <FieldError id={monthDaysErrorId} message={errors.daysOfMonth} />
          </div>
          <Label className="min-h-11 cursor-pointer sm:min-h-8">
            <Checkbox
              checked={value.lastDayOfMonth}
              onCheckedChange={(checked) => onChange({ ...value, lastDayOfMonth: checked })}
            />
            Último dia do mês
          </Label>
          <p className="text-sm text-muted-foreground">
            Dias que o mês não tem (como 31 em abril) são pulados. Marque “Último dia do mês” para
            não perder nenhum mês.
          </p>
        </div>
      ) : null}
    </div>
  );
}
