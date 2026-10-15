import { CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateShort, dateOnly, type DateOnly } from "@/lib/dates";
import type { Task } from "@/lib/tasks/hooks";
import { dueState } from "@/lib/tasks/view";

/** Due date of a task: "Atrasada" (red) and "Hoje" (highlighted) only while the task is pending. */
export function DueBadge({ task, today }: { task: Task; today: DateOnly }) {
  if (!task.dueDate) return null;

  const state = dueState(task, today);
  const date = formatDateShort(dateOnly(task.dueDate));

  if (state === "overdue") {
    return (
      <Badge variant="destructive">
        <CalendarIcon aria-hidden /> Atrasada · {date}
      </Badge>
    );
  }
  if (state === "today") {
    return (
      <Badge variant="default">
        <CalendarIcon aria-hidden /> Hoje
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <CalendarIcon aria-hidden /> {date}
    </Badge>
  );
}
