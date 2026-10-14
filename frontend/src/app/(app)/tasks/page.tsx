import type { Metadata } from "next";
import { CircleCheckBigIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Tarefas" };

export default function Page() {
  return (
    <>
      <PageHeader title="Tarefas" description="Tudo o que você precisa fazer." />
      <EmptyState
        icon={CircleCheckBigIcon}
        title="Nenhuma tarefa ainda"
        description="Em breve você poderá criar e acompanhar suas tarefas aqui."
      />
    </>
  );
}
