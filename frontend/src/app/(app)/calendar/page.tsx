import type { Metadata } from "next";
import { HabitCalendar } from "@/components/calendar/habit-calendar";
import { PageHeader } from "@/components/page-header";
import { fetchCalendarSeed } from "@/lib/calendar/server";
import { todayInBrasilia } from "@/lib/dates";

export const metadata: Metadata = { title: "Calendário" };

export default async function Page() {
  const today = todayInBrasilia();
  const seed = await fetchCalendarSeed(today);

  return (
    <>
      <PageHeader title="Calendário" description="Seus hábitos dia a dia." />
      <HabitCalendar today={today} seed={seed} />
    </>
  );
}
