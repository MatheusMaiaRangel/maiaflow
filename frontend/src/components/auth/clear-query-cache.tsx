"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Drops everything TanStack Query holds in memory. Rendered on the sign-in and sign-up pages: logout,
 * account deletion and an expired session all end up there, so the next person to sign in on this tab
 * never sees the previous user's tasks and habits.
 */
export function ClearQueryCache() {
  const queryClient = useQueryClient();
  useEffect(() => {
    queryClient.clear();
  }, [queryClient]);
  return null;
}
