"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/form-alert";
import { TextField } from "@/components/form/text-field";
import { dateOnly, formatDateShort, isDateOnly, toApiDateTime, type DateOnly } from "@/lib/dates";
import { effectiveFromBounds } from "@/lib/habits/date-limits";
import { describeSubmitError } from "@/lib/habits/form-errors";
import { useChangeRecurrence, type Habit } from "@/lib/habits/hooks";
import { buildRecurrencePayload, recurrenceFromHabit } from "@/lib/habits/recurrence";
import { changeRecurrenceSchema, type ChangeRecurrenceFormValues } from "@/lib/validation/habit";
import { HabitDialog, HabitDialogFooter } from "./habit-dialog";
import { RecurrenceFields } from "./recurrence-fields";

const FORM_FIELDS = [
  "effectiveFrom",
  "recurrence.intervalDays",
  "recurrence.daysOfWeek",
  "recurrence.daysOfMonth",
] as const;

type ChangeRecurrenceDialogProps = {
  habit: Habit;
  today: DateOnly;
  onClose: () => void;
};

export function ChangeRecurrenceDialog({ habit, today, onClose }: ChangeRecurrenceDialogProps) {
  return (
    <HabitDialog
      title="Alterar recorrência"
      description={`Nova frequência de “${habit.title}”.`}
      onClose={onClose}
    >
      <ChangeRecurrenceForm habit={habit} today={today} onDone={onClose} />
    </HabitDialog>
  );
}

type FormProps = { habit: Habit; today: DateOnly; onDone: () => void };

function ChangeRecurrenceForm({ habit, today, onDone }: FormProps) {
  const [serverError, setServerError] = useState<string>();
  const currentStart = dateOnly(habit.currentEffectiveFrom);
  const schema = useMemo(() => changeRecurrenceSchema(today, currentStart), [today, currentStart]);
  const bounds = useMemo(() => effectiveFromBounds(today, currentStart), [today, currentStart]);
  const changeRecurrence = useChangeRecurrence();
  const form = useForm<ChangeRecurrenceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { recurrence: recurrenceFromHabit(habit), effectiveFrom: "" },
  });
  const { register, handleSubmit, control, setError } = form;
  const { errors } = form.formState;
  const effectiveFrom = useWatch({ control, name: "effectiveFrom" });

  const onSubmit = (values: ChangeRecurrenceFormValues) => {
    setServerError(undefined);
    changeRecurrence.mutate(
      {
        id: habit.id,
        ...buildRecurrencePayload(values.recurrence),
        ...(values.effectiveFrom ? { effectiveFrom: toApiDateTime(values.effectiveFrom) } : {}),
      },
      {
        onSuccess: (updated) => {
          toast.success(
            `Recorrência alterada. Vale a partir de ${formatDateShort(dateOnly(updated.currentEffectiveFrom))}.`,
          );
          onDone();
        },
        onError: (error) => {
          const view = describeSubmitError(error, FORM_FIELDS);
          for (const [field, message] of view.fieldErrors) setError(field, { message });
          setServerError(view.alert);
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <FormAlert message={serverError} />
      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        Os dias que já foram gerados não mudam. Vale a partir de hoje (ou de amanhã se os hábitos de
        hoje já foram gerados).
        {currentStart > today
          ? ` Já existe uma mudança agendada a partir de ${formatDateShort(currentStart)}.`
          : ""}
      </p>
      <Controller
        control={control}
        name="recurrence"
        render={({ field }) => (
          <RecurrenceFields
            value={field.value}
            onChange={field.onChange}
            anchorDate={isDateOnly(effectiveFrom) ? effectiveFrom : null}
            errors={{
              intervalDays: errors.recurrence?.intervalDays?.message,
              daysOfWeek: errors.recurrence?.daysOfWeek?.message,
              daysOfMonth: errors.recurrence?.daysOfMonth?.message,
            }}
          />
        )}
      />
      <TextField
        label="Aplicar a partir de (opcional)"
        type="date"
        min={bounds.min}
        max={bounds.max}
        className="h-11 sm:h-8"
        error={errors.effectiveFrom?.message}
        {...register("effectiveFrom")}
      />
      <HabitDialogFooter
        pending={changeRecurrence.isPending}
        submitLabel="Alterar recorrência"
        pendingLabel="Salvando…"
      />
    </form>
  );
}
