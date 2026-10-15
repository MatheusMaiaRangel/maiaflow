import { z } from "zod";
import { isDateOnly, toApiDateTime } from "@/lib/dates";

export const TASK_TITLE_MAX_LENGTH = 150;
export const TASK_DESCRIPTION_MAX_LENGTH = 500;

/** Form values are plain strings; a blank description or due date means "none". */
export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Informe o título da tarefa.")
    .max(TASK_TITLE_MAX_LENGTH, `O título deve ter no máximo ${TASK_TITLE_MAX_LENGTH} caracteres.`),
  description: z
    .string()
    .trim()
    .max(
      TASK_DESCRIPTION_MAX_LENGTH,
      `A descrição deve ter no máximo ${TASK_DESCRIPTION_MAX_LENGTH} caracteres.`,
    ),
  dueDate: z
    .string()
    .refine((value) => value === "" || isDateOnly(value), "Informe uma data válida."),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

/** Body shared by create and update: blank fields become `null` (stored as "none" / cleared on PATCH). */
export function toTaskBody(values: TaskFormValues) {
  return {
    title: values.title.trim(),
    description: values.description.trim() === "" ? null : values.description.trim(),
    dueDate: values.dueDate === "" ? null : toApiDateTime(values.dueDate),
  };
}
