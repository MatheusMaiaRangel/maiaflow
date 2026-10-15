import { ClientApiError, errorMessage } from "@/lib/api/browser";
import { problemFieldErrors } from "@/lib/api/problem";

/** Form fields a server validation error can point at. */
export type HabitFormField =
  | "title"
  | "description"
  | "startDate"
  | "effectiveFrom"
  | "recurrence.intervalDays"
  | "recurrence.daysOfWeek"
  | "recurrence.daysOfMonth";

const API_FIELD_TO_FORM_FIELD: Record<string, HabitFormField> = {
  title: "title",
  description: "description",
  startDate: "startDate",
  effectiveFrom: "effectiveFrom",
  intervalDays: "recurrence.intervalDays",
  daysOfWeek: "recurrence.daysOfWeek",
  daysOfMonth: "recurrence.daysOfMonth",
};

export type SubmitErrorView<F extends HabitFormField> = {
  /** Errors to put under specific inputs. */
  fieldErrors: Array<[F, string]>;
  /** Message for the alert above the form; empty when every error was placed under an input. */
  alert?: string;
};

/**
 * Splits a failed submit into messages under inputs (model-binding errors the form has) and an alert
 * (anything else, like the API's domain validation or a network failure).
 */
export function describeSubmitError<F extends HabitFormField>(
  error: unknown,
  formFields: readonly F[],
): SubmitErrorView<F> {
  const serverFields = error instanceof ClientApiError ? problemFieldErrors(error.problem) : {};
  const fieldErrors = Object.entries(serverFields).flatMap(([apiField, message]) => {
    const formField = API_FIELD_TO_FORM_FIELD[apiField];
    const known = formFields.find((field) => field === formField);
    return known ? [[known, message] as [F, string]] : [];
  });

  return fieldErrors.length > 0 ? { fieldErrors } : { fieldErrors, alert: errorMessage(error) };
}
