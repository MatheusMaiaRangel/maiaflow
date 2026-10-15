"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/form-alert";
import { TextField } from "@/components/form/text-field";
import { TextareaField } from "@/components/form/textarea-field";
import { describeSubmitError } from "@/lib/habits/form-errors";
import { useUpdateHabit, type Habit } from "@/lib/habits/hooks";
import { editHabitSchema, type EditHabitFormValues } from "@/lib/validation/habit";
import { HabitDialog, HabitDialogFooter } from "./habit-dialog";

const FORM_FIELDS = ["title", "description"] as const;

type EditHabitDialogProps = { habit: Habit; onClose: () => void };

/** "Editar": title and description. The recurrence has its own dialog. */
export function EditHabitDialog({ habit, onClose }: EditHabitDialogProps) {
  return (
    <HabitDialog
      title="Editar hábito"
      description="Muda só o título e a descrição. Para mudar a frequência, use “Alterar recorrência”."
      onClose={onClose}
    >
      <EditHabitForm habit={habit} onDone={onClose} />
    </HabitDialog>
  );
}

function EditHabitForm({ habit, onDone }: { habit: Habit; onDone: () => void }) {
  const [serverError, setServerError] = useState<string>();
  const updateHabit = useUpdateHabit();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EditHabitFormValues>({
    resolver: zodResolver(editHabitSchema),
    defaultValues: { title: habit.title, description: habit.description ?? "" },
  });

  const onSubmit = (values: EditHabitFormValues) => {
    setServerError(undefined);
    updateHabit.mutate(
      // An empty description clears it on the server (`null`); omitting it would keep the old one.
      { id: habit.id, title: values.title, description: values.description || null },
      {
        onSuccess: () => {
          toast.success("Hábito atualizado.");
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
      <HabitDialogFooter
        pending={updateHabit.isPending}
        submitLabel="Salvar"
        pendingLabel="Salvando…"
      />
    </form>
  );
}
