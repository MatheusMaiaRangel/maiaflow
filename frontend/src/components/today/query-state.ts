/** The part of a TanStack query result the dashboard parts need (keeps them easy to test). */
export type QueryState<T> = {
  data: T | undefined;
  isError: boolean;
  refetch: () => unknown;
};

/** True when the query failed and there is nothing to show instead. */
export function hasFailed<T>(query: QueryState<T>): boolean {
  return query.isError && query.data === undefined;
}
