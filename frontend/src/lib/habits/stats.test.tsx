import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const get = vi.fn();

vi.mock("@/lib/api/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser")>()),
  getBrowserApi: () => ({ GET: get }),
}));

import { HABITS_KEY } from "./occurrences";
import { statsKey, useHabitStats, type HabitStats } from "./stats";

const TODAY = "2026-10-14";

const STATS: HabitStats = {
  start: "2026-09-15T00:00:00",
  end: "2026-10-14T00:00:00",
  days: [{ date: "2026-10-14T00:00:00", completed: 1, notCompleted: 0, pending: 1 }],
  habits: [],
};

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => get.mockReset());

describe("useHabitStats", () => {
  test("fetches the window from the API", async () => {
    get.mockResolvedValue({ data: STATS, response: new Response(null, { status: 200 }) });
    const { wrapper } = setup();

    const { result } = renderHook(() => useHabitStats(30, TODAY), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(STATS));
    expect(get).toHaveBeenCalledWith("/api/habits/stats", { params: { query: { days: 30 } } });
  });

  test("uses the server seed without a request while it is fresh", () => {
    const { wrapper } = setup();

    const { result } = renderHook(
      () => useHabitStats(30, TODAY, { data: STATS, fetchedAt: Date.now() }),
      {
        wrapper,
      },
    );

    expect(result.current.data).toEqual(STATS);
    expect(get).not.toHaveBeenCalled();
  });

  test("reports an API failure", async () => {
    get.mockResolvedValue({
      error: { status: 500 },
      response: new Response(null, { status: 500 }),
    });
    const { wrapper } = setup();

    const { result } = renderHook(() => useHabitStats(30, TODAY), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  test("lives under the habits prefix, so habit changes refresh it", async () => {
    get.mockResolvedValue({ data: STATS, response: new Response(null, { status: 200 }) });
    const { queryClient, wrapper } = setup();
    renderHook(() => useHabitStats(30, TODAY, { data: STATS, fetchedAt: Date.now() }), { wrapper });

    await queryClient.invalidateQueries({ queryKey: HABITS_KEY });

    expect(statsKey(30, TODAY)).toEqual(["habits", "stats", 30, TODAY]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  test("uses the new day's seed instead of yesterday's cache after midnight", () => {
    const { wrapper } = setup();
    const nextDay: HabitStats = { ...STATS, end: "2026-10-15T00:00:00" };

    const { result, rerender } = renderHook(
      ({ today, seed }: { today: string; seed: HabitStats }) =>
        useHabitStats(30, today, { data: seed, fetchedAt: Date.now() }),
      { wrapper, initialProps: { today: TODAY, seed: STATS } },
    );
    rerender({ today: "2026-10-15", seed: nextDay });

    expect(result.current.data).toEqual(nextDay);
    expect(get).not.toHaveBeenCalled();
  });
});
