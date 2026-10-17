// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const get = vi.fn();

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getAuthedApi: async () => ({ GET: get }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

import { fetchTodaySeed } from "./today-server";

const NOW = new Date("2026-10-14T15:00:00Z");

const ok = (data: unknown) => ({ data, response: new Response(null, { status: 200 }) });
const failed = (status: number) => ({
  error: { status },
  response: new Response(null, { status }),
});

function occurrence(id: number, date: string) {
  return { id, habitId: id, habitTitle: "Ler", date: `${date}T00:00:00`, status: "Pending" };
}

const TASKS = [{ id: 1, title: "Pagar", description: null, dueDate: null, status: "Pending" }];
const GRID = [
  occurrence(1, "2026-10-13"),
  occurrence(2, "2026-10-14"),
  occurrence(3, "2026-10-15"),
];
const STATS = { start: "2026-09-15T00:00:00", end: "2026-10-14T00:00:00", days: [], habits: [] };

function answer({ stats = ok(STATS) as unknown }: { stats?: unknown } = {}) {
  get.mockImplementation(async (path: string) => {
    if (path === "/api/tasks") return ok(TASKS);
    if (path === "/api/habits/calendar") return ok(GRID);
    if (stats instanceof Error) throw stats;
    return stats;
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  get.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("fetchTodaySeed", () => {
  test("reads tasks, the month grid and 30 days of stats in parallel", async () => {
    answer();

    const seed = await fetchTodaySeed();

    expect(get).toHaveBeenCalledTimes(3);
    expect(get).toHaveBeenCalledWith("/api/tasks");
    expect(get).toHaveBeenCalledWith("/api/habits/calendar", {
      params: { query: { start: "2026-09-27", end: "2026-10-31" } },
    });
    expect(get).toHaveBeenCalledWith("/api/habits/stats", { params: { query: { days: 30 } } });
    expect(seed.today).toBe("2026-10-14");
    expect(seed.tasks).toEqual({ data: TASKS, fetchedAt: NOW.getTime() });
    expect(seed.calendar.data).toEqual(GRID);
    expect(seed.stats).toEqual({ data: STATS, fetchedAt: NOW.getTime() });
  });

  test("seeds today's habits list with today's slice of the grid", async () => {
    answer();

    const seed = await fetchTodaySeed();

    expect(seed.occurrences.data).toEqual([occurrence(2, "2026-10-14")]);
  });

  test("leaves the stats to the client when the API fails", async () => {
    answer({ stats: failed(500) });

    const seed = await fetchTodaySeed();

    expect(seed.stats).toBeUndefined();
    expect(seed.tasks.data).toEqual(TASKS);
    expect(console.warn).toHaveBeenCalled();
  });

  test("leaves the stats to the client when the API cannot be reached", async () => {
    answer({ stats: new TypeError("fetch failed") });

    const seed = await fetchTodaySeed();

    expect(seed.stats).toBeUndefined();
  });

  test("still redirects to the login page when the stats call answers 401", async () => {
    answer({ stats: failed(401) });

    await expect(fetchTodaySeed()).rejects.toThrow("NEXT_REDIRECT:/auth/session-expired");
  });

  test("fails the page when the essential calls fail", async () => {
    get.mockImplementation(async (path: string) =>
      path === "/api/tasks" ? failed(500) : ok(path === "/api/habits/calendar" ? GRID : STATS),
    );

    await expect(fetchTodaySeed()).rejects.toThrow("status 500");
  });
});
