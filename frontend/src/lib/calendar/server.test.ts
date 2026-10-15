import { describe, expect, test, vi } from "vitest";

const get = vi.fn();

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getAuthedApi: async () => ({ GET: get }),
}));

import { fetchCalendarSeed } from "./server";

describe("fetchCalendarSeed", () => {
  test("reads the grid range of today's month and stamps the fetch time", async () => {
    const data = [
      { id: 1, habitId: 1, habitTitle: "Ler", date: "2026-10-14T00:00:00", status: "Pending" },
    ];
    get.mockResolvedValue({ data, response: new Response(null, { status: 200 }) });
    const before = Date.now();

    const seed = await fetchCalendarSeed("2026-10-14");

    expect(get).toHaveBeenCalledWith("/api/habits/calendar", {
      params: { query: { start: "2026-09-27", end: "2026-10-31" } },
    });
    expect(seed.data).toEqual(data);
    expect(seed.fetchedAt).toBeGreaterThanOrEqual(before);
  });

  test("throws when the API fails", async () => {
    get.mockResolvedValue({
      error: { status: 500 },
      response: new Response(null, { status: 500 }),
    });

    await expect(fetchCalendarSeed("2026-10-14")).rejects.toThrow("status 500");
  });
});
