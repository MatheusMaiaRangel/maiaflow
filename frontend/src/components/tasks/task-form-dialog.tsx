"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/form-alert";
import { TextField } from "@/components/form/text-field";
import { TextareaField } from "@/components/form/textarea-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClientApiError, errorMessage } from "@/lib/api/browser";
import { problemFieldErrors } from "@/lib/api/problem";
import { dateOnly, type DateOnly } from "@/lib/dates";
import { useCreateTask, useUpdateTask, type Task } from "@/lib/tasks/hooks";
import { taskFormSchema, toTaskBody, type TaskFormValues } from "@/lib/validation/task";

const FORM_FIELDS = ["title", "description", "dueDate"] as const;

export type TaskFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The task being edited; leave out to create a new one. */
  task?: Task | null;
  /** Due date (`yyyy-MM-dd`) pre-filled when creating, e.g. today on the Today page. */
  defaultDueDate?: DateOnly;
};

/** Create / edit dialog for a task. The form remounts on every open, so it always starts fresh. */
export function TaskFormDialog({ open, onOpenChange, task, defaultDueDate }: TaskFormDialogProps) {
  const isEditing = Boolean(task);
  // While a save is running Esc, the overlay and the close button must not hide a possible failure.
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Altere os dados da tarefa." : "Diga o que você precisa fazer."}
          </DialogDescription>
        </DialogHeader>
        <TaskForm
          task={task ?? undefined}
          defaultDueDate={defaultDueDate}
          onDone={() => onOpenChange(false)}
          onBusyChange={setBusy}
        />
      </DialogContent>
    </Dialog>
  );
}

function initialValues(
  task: Task | undefined,
  defaultDueDate: DateOnly | undefined,
): TaskFormValues {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    dueDate: task?.dueDate ? dateOnly(task.dueDate) : task ? "" : (defaultDueDate ?? ""),
  };
}

function TaskForm({
  task,
  defaultDueDate,
  onDone,
  onBusyChange,
}: {
  task?: Task;
  defaultDueDate?: DateOnly;
  onDone: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [serverError, setServerError] = useState<string>();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: initialValues(task, defaultDueDate),
  });
  useEffect(() => {
    onBusyChange(isSubmitting);
    return () => onBusyChange(false);
  }, [isSubmitting, onBusyChange]);
  const hasDueDate = useWatch({ control, name: "dueDate" }) !== "";

  const onSubmit = async (values: TaskFormValues) => {
    setServerError(undefined);
    const body = toTaskBody(values);
    try {
      if (task) await updateTask.mutateAsync({ id: task.id, ...body });
      else await createTask.mutateAsync(body);
    } catch (error) {
      showServerError(error);
      return;
    }
    toast.success(task ? "Tarefa atualizada." : "Tarefa criada.");
    onDone();
  };

  const showServerError = (error: unknown) => {
    const fieldErrors = error instanceof ClientApiError ? problemFieldErrors(error.problem) : {};
    const mapped = FORM_FIELDS.filter((field) => fieldErrors[field]);
    for (const field of mapped) setError(field, { message: fieldErrors[field] });
    // Field errors show under their field; anything else goes in the alert on top of the form.
    if (mapped.length === 0) {
      setServerError(
        errorMessage(
          error,
          task ? "Não foi possível salvar a tarefa." : "Não foi possível criar a tarefa.",
        ),
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <FormAlert message={serverError} />
      <TextField
        label="Título"
        autoComplete="off"
        error={errors.title?.message}
        {...register("title")}
      />
      <TextareaField
        label="Descrição (opcional)"
        rows={3}
        error={errors.description?.message}
        {...register("description")}
      />
      <div className="grid gap-1">
        <TextField
          label="Prazo (opcional)"
          type="date"
          error={errors.dueDate?.message}
          {...register("dueDate")}
        />
        {hasDueDate ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="justify-self-start px-0"
            onClick={() => setValue("dueDate", "", { shouldValidate: true })}
          >
            Remover prazo
          </Button>
        ) : null}
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />} disabled={isSubmitting}>
          Cancelar
        </DialogClose>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
          {isSubmitting ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
