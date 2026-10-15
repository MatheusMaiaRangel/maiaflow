import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER_COUNT = 3;

/** Placeholder cards while the list loads. */
export function HabitsSkeleton() {
  return (
    <div className="grid gap-4" role="status" aria-busy="true" aria-label="Carregando hábitos">
      {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
        <Skeleton key={index} className="h-36 w-full rounded-xl" />
      ))}
    </div>
  );
}
