import type { Metadata } from "next";
import { UserIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Perfil" };

export default function Page() {
  return (
    <>
      <PageHeader title="Perfil" description="Seus dados de acesso." />
      <EmptyState
        icon={UserIcon}
        title="Perfil em construção"
        description="Em breve você poderá editar seu nome, e-mail e senha."
      />
    </>
  );
}
