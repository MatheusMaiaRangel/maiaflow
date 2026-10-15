import "server-only";
import { getAuthedApi, unwrap } from "@/lib/api/client";
import { todayInBrasilia, type DateOnly } from "@/lib/dates";
import type { Occurrence } from "@/lib/habits/occurrences";
import type { ServerSeed } from "@/lib/query-seed";
import type { Task } from "@/lib/tasks/hooks";

export type TodaySeed = {
  today: DateOnly;
  tasks: ServerSeed<Task[]>;
  occurrences: ServerSeed<Occurrence[]>;
};

/** Reads, on the server, everything the Today screen needs. "Today" is the Brasília date. */
export async function fetchTodaySeed(): Promise<TodaySeed> {
  const today = todayInBrasilia();
  const api = await getAuthedApi();
  const [tasks, occurrences] = await Promise.all([
    api.GET("/api/tasks"),
    api.GET("/api/habits/calendar", { params: { query: { start: today, end: today } } }),
  ]);

  return {
    today,
    tasks: { data: unwrap(tasks), fetchedAt: Date.now() },
    occurrences: { data: unwrap(occurrences), fetchedAt: Date.now() },
  };
}
