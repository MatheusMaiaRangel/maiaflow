import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import type { Habit } from "@/lib/habits/hooks";

export function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 1,
    title: "Beber água",
    description: null,
    startDate: "2026-10-01T00:00:00",
    currentEffectiveFrom: "2026-10-01T00:00:00",
    currentFrequencyType: "Daily",
    currentIntervalDays: null,
    currentDaysOfWeek: 0,
    currentDaysOfMonth: [],
    currentLastDayOfMonth: false,
    ...overrides,
  };
}

export function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

/** What openapi-fetch resolves to for a successful call. */
export function apiOk<T>(data: T, status = 200) {
  return { data, response: { ok: true, status } as Response };
}

/** What openapi-fetch resolves to for a failed call. */
export function apiFail(status: number, error: unknown) {
  return { error, response: { ok: false, status } as Response };
}
