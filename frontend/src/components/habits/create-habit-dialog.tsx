"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/form-alert";
import { TextField } from "@/components/form/text-field";
import { TextareaField } from "@/components/form/textarea-field";
import { toApiDateTime, isDateOnly, type DateOnly } from "@/lib/dates";
import { startDateBounds } from "@/lib/habits/date-limits";
import { describeSubmitError } from "@/lib/habits/form-errors";
import { useCreateHabit } from "@/lib/habits/hooks";
import { buildRecurrencePayload, DEFAULT_RECURRENCE } from "@/lib/habits/recurrence";
import { createHabitSchema, type CreateHabitFormValues } from "@/lib/validation/habit";
import { HabitDialog, HabitDialogFooter } from "./habit-dialog";
import { RecurrenceFields } from "./recurrence-fields";

const FORM_FIELDS = [
  "title",
  "description",
  "startDate",
  "recurrence.intervalDays",
  "recurrence.daysOfWeek",
  "recurrence.daysOfMonth",
] as const;

type CreateHabitDialogProps = {
  /** Brasília date from the server: the default start date and the base of the allowed range. */
  today: DateOnly;
  onClose: () => void;
};

export function CreateHabitDialog({ today, onClose }: CreateHabitDialogProps) {
  return (
    <HabitDialog
      title="Novo hábito"
      description="Dê um nome, escolha quando começa e com que frequência se repete."
      onClose={onClose}
    >
      <CreateHabitForm today={today} onDone={onClose} />
    </HabitDialog>
  );
}

function CreateHabitForm({ today, onDone }: { today: DateOnly; onDone: () => void }) {
  const [serverError, setServerError] = useState<string>();
  const schema = useMemo(() => createHabitSchema(today), [today]);
  const bounds = useMemo(() => startDateBounds(today), [today]);
  const createHabit = useCreateHabit();
  const form = useForm<CreateHabitFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", startDate: today, recurrence: DEFAULT_RECURRENCE },
  });
  const { register, handleSubmit, control, setError } = form;
  const { errors } = form.formState;
  const startDate = useWatch({ control, name: "startDate" });

  const onSubmit = (values: CreateHabitFormValues) => {
    setServerError(undefined);
    createHabit.mutate(
      {
        title: values.title,
        description: values.description || undefined,
        startDate: toApiDateTime(values.startDate),
        ...buildRecurrencePayload(values.recurrence),
      },
      {
        onSuccess: () => {
          toast.success("Hábito criado.");
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
      <TextField
        label="Título"
        autoComplete="off"
        className="h-11 sm:h-8"
        error={errors.title?.message}
        {...register("title")}
      />
      <TextareaField
        label="Descrição (opcional)"
        rows={3}
        error={errors.description?.message}
        {...register("description")}
      />
      <TextField
        label="Começa em"
        type="date"
        min={bounds.min}
        max={bounds.max}
        className="h-11 sm:h-8"
        error={errors.startDate?.message}
        {...register("startDate")}
      />
      <Controller
        control={control}
        name="recurrence"
        render={({ field }) => (
          <RecurrenceFields
            value={field.value}
            onChange={field.onChange}
            anchorDate={isDateOnly(startDate) ? startDate : null}
            errors={{
              intervalDays: errors.recurrence?.intervalDays?.message,
              daysOfWeek: errors.recurrence?.daysOfWeek?.message,
              daysOfMonth: errors.recurrence?.daysOfMonth?.message,
            }}
          />
        )}
      />
      <HabitDialogFooter
        pending={createHabit.isPending}
        submitLabel="Criar hábito"
        pendingLabel="Criando…"
      />
    </form>
  );
}
