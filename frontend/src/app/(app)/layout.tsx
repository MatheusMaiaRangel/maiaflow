import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { DayChangeRefresh } from "@/components/day-change-refresh";
import { getCurrentUser } from "@/lib/auth/user";
import { todayInBrasilia } from "@/lib/dates";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    <AppShell user={user}>
      <DayChangeRefresh today={todayInBrasilia()} />
      {children}
    </AppShell>
  );
}
