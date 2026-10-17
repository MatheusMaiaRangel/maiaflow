import { AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Error of one part of the Today screen, with a retry button. `compact` fits it inside a small card. */
export function SectionError({
  what,
  onRetry,
  compact = false,
}: {
  what: string;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center text-center",
        compact
          ? "gap-2 text-sm"
          : "gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8",
      )}
    >
      {compact ? null : <AlertCircleIcon className="size-6 text-destructive" aria-hidden />}
      <p className="font-medium">Não foi possível carregar {what}</p>
      <Button variant="outline" size={compact ? "sm" : "default"} onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}

export function ListSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="grid gap-2">
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-16 rounded-xl" />
    </div>
  );
}
