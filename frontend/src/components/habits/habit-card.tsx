"use client";

import { CalendarIcon, PencilIcon, RepeatIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dateOnly, formatDateShort, type DateOnly } from "@/lib/dates";
import type { Habit } from "@/lib/habits/hooks";
import { summarizeRecurrence } from "@/lib/habits/recurrence";

type HabitCardProps = {
  habit: Habit;
  /** Brasília date from the server. */
  today: DateOnly;
  onEdit: (habit: Habit) => void;
  onChangeRecurrence: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
};

const ACTION_CLASS = "h-11 sm:h-7";

export function HabitCard({ habit, today, onEdit, onChangeRecurrence, onDelete }: HabitCardProps) {
  const ruleStart = dateOnly(habit.currentEffectiveFrom);
  const isScheduled = ruleStart > today;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="break-words">{habit.title}</CardTitle>
        {habit.description ? (
          <CardDescription className="break-words whitespace-pre-line">
            {habit.description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-1.5 text-sm">
          <p className="flex items-start gap-2">
            <RepeatIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>{summarizeRecurrence(habit, ruleStart)}</span>
          </p>
          <p className="flex items-start gap-2 text-muted-foreground">
            <CalendarIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Começou em {formatDateShort(dateOnly(habit.startDate))}</span>
          </p>
          {isScheduled ? (
            <div>
              <Badge variant="secondary">A partir de {formatDateShort(ruleStart)}</Badge>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className={ACTION_CLASS}
            aria-label={`Editar hábito ${habit.title}`}
            onClick={() => onEdit(habit)}
          >
            <PencilIcon aria-hidden />
            Editar
          </Button>
          <Button
            variant="outline"
            className={ACTION_CLASS}
            aria-label={`Alterar recorrência de ${habit.title}`}
            onClick={() => onChangeRecurrence(habit)}
          >
            <RepeatIcon aria-hidden />
            Alterar recorrência
          </Button>
          <Button
            variant="ghost"
            className={`${ACTION_CLASS} text-destructive hover:text-destructive`}
            aria-label={`Excluir hábito ${habit.title}`}
            onClick={() => onDelete(habit)}
          >
            <Trash2Icon aria-hidden />
            Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
