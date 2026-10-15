import { CheckIcon, CircleDashedIcon, XIcon, type LucideIcon } from "lucide-react";
import type { OccurrenceStatus } from "@/lib/habits/occurrences";

export type StatusMeta = {
  status: OccurrenceStatus;
  label: string;
  icon: LucideIcon;
  /** Classes for the selected state of the control. */
  activeClass: string;
  /** Classes for the dot in the calendar cell. */
  dotClass: string;
};

/** Display order of the three options: done, not done, pending. */
export const STATUS_OPTIONS: readonly StatusMeta[] = [
  {
    status: "Completed",
    label: "Feito",
    icon: CheckIcon,
    activeClass:
      "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600/90 dark:border-emerald-500 dark:bg-emerald-600",
    dotClass: "bg-emerald-600 dark:bg-emerald-500",
  },
  {
    status: "NotCompleted",
    label: "Não feito",
    icon: XIcon,
    activeClass:
      "border-rose-600 bg-rose-600 text-white hover:bg-rose-600/90 dark:border-rose-500 dark:bg-rose-600",
    dotClass: "bg-rose-600 dark:bg-rose-500",
  },
  {
    status: "Pending",
    label: "Pendente",
    icon: CircleDashedIcon,
    activeClass: "border-foreground/30 bg-muted text-foreground hover:bg-muted",
    dotClass: "border border-muted-foreground/60 bg-transparent",
  },
];

export function statusMeta(status: OccurrenceStatus): StatusMeta {
  return STATUS_OPTIONS.find((option) => option.status === status) ?? STATUS_OPTIONS[2];
}
