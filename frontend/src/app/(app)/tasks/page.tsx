import type { Metadata } from "next";
import { TasksView } from "@/components/tasks/tasks-view";
import { getAuthedApi, unwrap } from "@/lib/api/client";
import { todayInBrasilia } from "@/lib/dates";
import { toSeed } from "@/lib/query-seed";

export const metadata: Metadata = { title: "Tarefas" };

export default async function Page() {
  const api = await getAuthedApi();
  const tasks = unwrap(await api.GET("/api/tasks"));

  return <TasksView seed={toSeed(tasks)} today={todayInBrasilia()} />;
}
