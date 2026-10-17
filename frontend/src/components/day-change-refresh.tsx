"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { todayInBrasilia, type DateOnly } from "@/lib/dates";

/** How often an open, visible tab checks whether the day changed. */
export const DAY_CHECK_INTERVAL_MS = 60_000;

/**
 * Refreshes the route once the Brasília day moves past `today` (the day the server rendered), so a tab left
 * open overnight stops showing yesterday. Checks when the tab becomes visible or focused, and every minute
 * while visible. The browser clock only triggers the refresh: the server still decides the day (D15). It
 * refreshes once per new day, even if the server keeps answering the old one.
 */
export function DayChangeRefresh({ today }: { today: DateOnly }) {
  const router = useRouter();
  const refreshedFor = useRef<DateOnly | undefined>(undefined);

  useEffect(() => {
    function check() {
      if (document.visibilityState !== "visible") return;
      const current = todayInBrasilia();
      if (current === today || current === refreshedFor.current) return;
      refreshedFor.current = current;
      router.refresh();
    }

    const interval = window.setInterval(check, DAY_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [today, router]);

  return null;
}
