/**
 * What each variable means, in the words the dashboard shows (Brazilian Portuguese). The phase 7 builder
 * lists these; the engine uses `unit` and `kind` to validate queries.
 */
import type { Grouping, HabitVariable, TaskVariable, Unit, Variable } from "./types";

export type VariableInfo = {
  source: "tasks" | "habits";
  unit: Unit;
  /**
   * `event`: counted on the day something happened, inside the period. `snapshot`: how tasks are right now;
   * with no grouping the period is ignored, with a time grouping they are placed on their due date.
   * `streak`: the run that ends today; the period is ignored.
   */
  kind: "event" | "snapshot" | "rate" | "streak";
  label: string;
  description: string;
};

export const VARIABLE_INFO: Readonly<Record<Variable, VariableInfo>> = {
  "tasks.created": {
    source: "tasks",
    unit: "count",
    kind: "event",
    label: "Tarefas criadas",
    description: "Tarefas criadas em cada dia. As anteriores ao histórico ficam de fora.",
  },
  "tasks.completed": {
    source: "tasks",
    unit: "count",
    kind: "event",
    label: "Tarefas concluídas",
    description: "Tarefas concluídas em cada dia.",
  },
  "tasks.completedOnTime": {
    source: "tasks",
    unit: "count",
    kind: "event",
    label: "Concluídas no prazo",
    description: "Concluídas até o dia do prazo.",
  },
  "tasks.completedLate": {
    source: "tasks",
    unit: "count",
    kind: "event",
    label: "Concluídas com atraso",
    description: "Concluídas depois do dia do prazo.",
  },
  "tasks.completedWithDueDate": {
    source: "tasks",
    unit: "count",
    kind: "event",
    label: "Concluídas com prazo",
    description: "Concluídas que tinham prazo (no prazo ou com atraso).",
  },
  "tasks.completedWithoutDueDate": {
    source: "tasks",
    unit: "count",
    kind: "event",
    label: "Concluídas sem prazo",
    description: "Concluídas que não tinham prazo.",
  },
  "tasks.openPending": {
    source: "tasks",
    unit: "count",
    kind: "snapshot",
    label: "Pendentes no prazo",
    description: "Pendentes com prazo para hoje ou depois.",
  },
  "tasks.openOverdue": {
    source: "tasks",
    unit: "count",
    kind: "snapshot",
    label: "Atrasadas",
    description: "Pendentes com o prazo já vencido.",
  },
  "tasks.openWithoutDueDate": {
    source: "tasks",
    unit: "count",
    kind: "snapshot",
    label: "Pendentes sem prazo",
    description: "Pendentes que não têm prazo.",
  },
  "habits.scheduled": {
    source: "habits",
    unit: "count",
    kind: "event",
    label: "Hábitos previstos",
    description: "Ocorrências de hábitos previstas em cada dia.",
  },
  "habits.completed": {
    source: "habits",
    unit: "count",
    kind: "event",
    label: "Hábitos feitos",
    description: "Ocorrências marcadas como feitas.",
  },
  "habits.notCompleted": {
    source: "habits",
    unit: "count",
    kind: "event",
    label: "Hábitos não feitos",
    description: "Ocorrências marcadas como não feitas.",
  },
  "habits.pending": {
    source: "habits",
    unit: "count",
    kind: "event",
    label: "Hábitos pendentes",
    description: "Ocorrências ainda sem marcação.",
  },
  "habits.completionRate": {
    source: "habits",
    unit: "percent",
    kind: "rate",
    label: "Taxa de conclusão",
    description:
      "Feitos em relação aos previstos. Hoje e os dias seguintes só contam depois de marcados.",
  },
  "habits.currentStreak": {
    source: "habits",
    unit: "streak",
    kind: "streak",
    label: "Sequência atual",
    description: "Ocorrências feitas em seguida até hoje (olha até 365 dias para trás).",
  },
};

export function isTaskVariable(variable: Variable): variable is TaskVariable {
  return VARIABLE_INFO[variable].source === "tasks";
}

export function isHabitVariable(variable: Variable): variable is HabitVariable {
  return VARIABLE_INFO[variable].source === "habits";
}

export const GROUPING_LABELS: Readonly<Record<Grouping, string>> = {
  none: "Total",
  day: "Por dia",
  week: "Por semana",
  weekday: "Por dia da semana",
  habit: "Por hábito",
};
