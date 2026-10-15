import "server-only";
import { getAuthedApi, unwrap } from "@/lib/api/client";
import type { DateOnly } from "@/lib/dates";
import { startOfMonth } from "@/lib/dates";
import type { Occurrence } from "@/lib/habits/occurrences";
import type { ServerSeed } from "@/lib/query-seed";
import { gridRange } from "./grid";

/** Reads, on the server, the occurrences of the grid of the month that contains `today`. */
export async function fetchCalendarSeed(today: DateOnly): Promise<ServerSeed<Occurrence[]>> {
  const { start, end } = gridRange(startOfMonth(today));
  const api = await getAuthedApi();
  const data = unwrap(await api.GET("/api/habits/calendar", { params: { query: { start, end } } }));
  return { data, fetchedAt: Date.now() };
}
