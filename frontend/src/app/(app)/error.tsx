"use client";

import { TriangleAlertIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid justify-items-center gap-4">
      <EmptyState
        icon={TriangleAlertIcon}
        title="Algo deu errado"
        description="Não foi possível carregar esta página. Tente novamente em instantes."
      />
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
