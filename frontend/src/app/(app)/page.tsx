import type { Metadata } from "next";
import { HouseIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Hoje" };

export default function Page() {
  return (
    <>
      <PageHeader title="Hoje" description="Seu dia em um só lugar." />
      <EmptyState
        icon={HouseIcon}
        title="Nada por aqui ainda"
        description="Suas tarefas e hábitos de hoje vão aparecer aqui."
      />
    </>
  );
}
