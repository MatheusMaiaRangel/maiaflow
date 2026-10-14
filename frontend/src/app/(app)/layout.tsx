import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { getCurrentUser } from "@/lib/auth/user";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return <AppShell user={user}>{children}</AppShell>;
}
