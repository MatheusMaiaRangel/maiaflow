import type { Metadata } from "next";
import { RepeatIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Hábitos" };

export default function Page() {
  return (
    <>
      <PageHeader title="Hábitos" description="O que você quer repetir." />
      <EmptyState
        icon={RepeatIcon}
        title="Nenhum hábito ainda"
        description="Em breve você poderá cadastrar hábitos e a frequência de cada um."
      />
    </>
  );
}
