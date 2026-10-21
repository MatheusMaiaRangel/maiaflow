import type { Metadata } from "next";
import { TodayView } from "@/components/today/today-view";
import { fetchTodaySeed } from "@/lib/today-server";

export const metadata: Metadata = { title: "Hoje" };

export default async function Page() {
  const { today, tasks, occurrences, calendar, stats, dashboard } = await fetchTodaySeed();
  return (
    <TodayView
      today={today}
      tasksSeed={tasks}
      occurrencesSeed={occurrences}
      calendarSeed={calendar}
      statsSeed={stats}
      dashboardSeed={dashboard}
    />
  );
}
