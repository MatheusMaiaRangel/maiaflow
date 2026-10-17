import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const get = vi.fn();
const patch = vi.fn();

vi.mock("@/lib/api/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser")>()),
  getBrowserApi: () => ({ GET: get, PATCH: patch }),
}));

import {
  calendarKey,
  STATS_KEY,
  useOccurrences,
  useSetOccurrenceStatus,
  type Occurrence,
} from "./occurrences";

const START = "2026-09-27";
const END = "2026-10-31";

function occurrence(id: number, status: Occurrence["status"] = "Pending"): Occurrence {
  return { id, habitId: 1, habitTitle: "Beber água", date: "2026-10-14T00:00:00", status };
}

function ok<T>(data: T) {
  return { data, response: new Response(null, { status: 200 }) };
}

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
});

describe("useOccurrences", () => {
  test("fetches the range from the API", async () => {
    get.mockResolvedValue(ok([occurrence(1)]));
    const { wrapper } = setup();

    const { result } = renderHook(() => useOccurrences(START, END), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([occurrence(1)]));
    expect(get).toHaveBeenCalledWith("/api/habits/calendar", {
      params: { query: { start: START, end: END } },
    });
  });

  test("uses the server seed without a request while it is fresh", () => {
    const { wrapper } = setup();

    const { result } = renderHook(
      () => useOccurrences(START, END, { data: [occurrence(1)], fetchedAt: Date.now() }),
      { wrapper },
    );

    expect(result.current.data).toEqual([occurrence(1)]);
    expect(get).not.toHaveBeenCalled();
  });

  test("keeps the previous range on screen while the next one loads", async () => {
    get.mockResolvedValueOnce(ok([occurrence(1)]));
    const { wrapper } = setup();
    const { result, rerender } = renderHook(({ start }) => useOccurrences(start, END), {
      wrapper,
      initialProps: { start: START },
    });
    await waitFor(() => expect(result.current.data).toEqual([occurrence(1)]));

    get.mockReturnValueOnce(new Promise(() => {}));
    rerender({ start: "2026-08-30" });

    expect(result.current.data).toEqual([occurrence(1)]);
    expect(result.current.isPlaceholderData).toBe(true);
  });
});

describe("useSetOccurrenceStatus", () => {
  test("updates every cached range at once and sends the PATCH", async () => {
    patch.mockResolvedValue(ok(occurrence(1, "Completed")));
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(calendarKey(START, END), [occurrence(1), occurrence(2)]);
    queryClient.setQueryData(calendarKey("2026-10-01", "2026-10-31"), [occurrence(1)]);
    const { result } = renderHook(() => useSetOccurrenceStatus(), { wrapper });

    await act(() => result.current.mutateAsync({ id: 1, status: "Completed" }));

    expect(patch).toHaveBeenCalledWith("/api/habits/occurrences/{occurrenceId}/status", {
      params: { path: { occurrenceId: 1 } },
      body: { status: "Completed" },
    });
  });

  test("shows the new status immediately in every cached range", async () => {
    patch.mockReturnValue(new Promise(() => {}));
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(calendarKey(START, END), [occurrence(1), occurrence(2)]);
    queryClient.setQueryData(calendarKey("2026-10-01", "2026-10-31"), [occurrence(1)]);
    const { result } = renderHook(() => useSetOccurrenceStatus(), { wrapper });

    act(() => result.current.mutate({ id: 1, status: "Completed" }));

    await waitFor(() => {
      expect(queryClient.getQueryData<Occurrence[]>(calendarKey(START, END))).toEqual([
        occurrence(1, "Completed"),
        occurrence(2),
      ]);
    });
    expect(queryClient.getQueryData<Occurrence[]>(calendarKey("2026-10-01", "2026-10-31"))).toEqual(
      [occurrence(1, "Completed")],
    );
  });

  test("rolls back when the API refuses", async () => {
    patch.mockResolvedValue({
      error: { status: 404 },
      response: new Response(null, { status: 404 }),
    });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(calendarKey(START, END), [occurrence(1)]);
    const { result } = renderHook(() => useSetOccurrenceStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 1, status: "Completed" }).catch(() => undefined);
    });

    expect(queryClient.getQueryData<Occurrence[]>(calendarKey(START, END))).toEqual([
      occurrence(1),
    ]);
  });

  test("refuses to update an occurrence that is not stored yet and leaves the cache alone", async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(calendarKey(START, END), [occurrence(0), occurrence(0)]);
    const { result } = renderHook(() => useSetOccurrenceStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 0, status: "Completed" }).catch(() => undefined);
    });

    expect(patch).not.toHaveBeenCalled();
    expect(queryClient.getQueryData<Occurrence[]>(calendarKey(START, END))).toEqual([
      occurrence(0),
      occurrence(0),
    ]);
  });

  test("refetches the calendars and the stats once the last mutation settles", async () => {
    const { queryClient, wrapper } = setup();
    const stats = [...STATS_KEY, 30];
    queryClient.setQueryData(calendarKey(START, END), [occurrence(1), occurrence(2)]);
    queryClient.setQueryData(stats, { days: [], habits: [] });
    let finishFirst: (value: unknown) => void = () => {};
    patch
      .mockReturnValueOnce(new Promise((resolve) => (finishFirst = resolve)))
      .mockResolvedValueOnce(ok(occurrence(2, "Completed")));
    const { result } = renderHook(() => useSetOccurrenceStatus(), { wrapper });

    act(() => result.current.mutate({ id: 1, status: "Completed" }));
    await act(() => result.current.mutateAsync({ id: 2, status: "Completed" }));

    // The first change is still in flight: refetching now could bring its old status back.
    expect(queryClient.getQueryState(stats)?.isInvalidated).toBe(false);

    await act(async () => finishFirst(ok(occurrence(1, "Completed"))));

    await waitFor(() => expect(queryClient.getQueryState(stats)?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(calendarKey(START, END))?.isInvalidated).toBe(true);
  });
});
