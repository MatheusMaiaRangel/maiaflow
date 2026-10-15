import type { Metadata } from "next";
import { HabitsView } from "@/components/habits/habits-view";
import { getAuthedApi, unwrap } from "@/lib/api/client";
import { todayInBrasilia } from "@/lib/dates";
import { toSeed } from "@/lib/query-seed";

export const metadata: Metadata = { title: "Hábitos" };

export default async function Page() {
  const api = await getAuthedApi();
  const habits = unwrap(await api.GET("/api/habits"));

  return <HabitsView seed={toSeed(habits)} today={todayInBrasilia()} />;
}
