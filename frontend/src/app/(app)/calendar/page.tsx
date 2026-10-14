import type { Metadata } from "next";
import { CalendarDaysIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Calendário" };

export default function Page() {
  return (
    <>
      <PageHeader title="Calendário" description="Seus hábitos dia a dia." />
      <EmptyState
        icon={CalendarDaysIcon}
        title="Calendário vazio"
        description="Em breve você verá e marcará seus hábitos por dia."
      />
    </>
  );
}
