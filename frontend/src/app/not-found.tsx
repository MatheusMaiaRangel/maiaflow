import { SearchXIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <EmptyState
        icon={SearchXIcon}
        title="Página não encontrada"
        description="O endereço não existe ou foi movido."
      />
      <Link href="/" className={buttonVariants()}>
        Voltar ao início
      </Link>
    </main>
  );
}
