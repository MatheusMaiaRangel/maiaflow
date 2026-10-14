/** Shape of the API's error body (RFC 9457 ProblemDetails, plus the `errors` map of model binding). */
export type ProblemBody = {
  status?: number | null;
  title?: string | null;
  detail?: string | null;
  errors?: Record<string, string[]> | null;
};

export const GENERIC_ERROR_MESSAGE = "Algo deu errado. Tente novamente.";
export const NETWORK_ERROR_MESSAGE = "Não foi possível conectar ao servidor. Tente novamente.";

function isProblemBody(value: unknown): value is ProblemBody {
  return typeof value === "object" && value !== null;
}

/** The API's `detail` is already user-facing Portuguese; anything else gets a generic message. */
export function problemMessage(problem: unknown, fallback: string = GENERIC_ERROR_MESSAGE): string {
  if (!isProblemBody(problem)) return fallback;
  if (typeof problem.detail === "string" && problem.detail.trim()) return problem.detail;

  const firstFieldError = Object.values(problem.errors ?? {})
    .flat()
    .find((message) => typeof message === "string" && message.trim());
  return firstFieldError ?? fallback;
}

/** First model-binding error per field, keyed by the camelCase JSON name (`Title` becomes `title`). */
export function problemFieldErrors(problem: unknown): Record<string, string> {
  if (!isProblemBody(problem) || !problem.errors) return {};

  const result: Record<string, string> = {};
  for (const [key, messages] of Object.entries(problem.errors)) {
    const message = messages?.[0];
    const field = key.split(".").pop() ?? key;
    if (message && field && !field.startsWith("$")) {
      result[field.charAt(0).toLowerCase() + field.slice(1)] = message;
    }
  }
  return result;
}
