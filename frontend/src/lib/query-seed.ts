/**
 * Data a Server Component already fetched, handed to a client query so the first paint needs no extra
 * request. `fetchedAt` (ms since epoch, taken on the server) lets the query's `staleTime` apply.
 */
export type ServerSeed<T> = { data: T; fetchedAt: number };

/** Wraps data fetched on the server for a client query. Pages cannot call `Date.now` themselves (lint). */
export function toSeed<T>(data: T, now: () => number = Date.now): ServerSeed<T> {
  return { data, fetchedAt: now() };
}
