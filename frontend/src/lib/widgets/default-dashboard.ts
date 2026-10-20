/**
 * The dashboard every user starts with (phase 6 mockup): Tarefas, Hábitos and Tendências. Phase 7's
 * "Restaurar padrão" brings this set back.
 */
import type { DashboardConfig } from "./config";

const ALL_HABITS = { kind: "all" } as const;
const LAST_30 = { kind: "last", days: 30 } as const;
const LAST_90 = { kind: "last", days: 90 } as const;

export const DEFAULT_DASHBOARD: DashboardConfig = {
  version: 1,
  sections: [
    {
      id: "tasks",
      title: "Tarefas",
      widgets: [
        {
          id: "tasks-per-day",
          title: "Concluídas por dia",
          chart: "bar",
          series: [
            { metric: { variable: "tasks.completed" }, label: "Concluídas", color: "blue" },
            {
              metric: { variable: "tasks.created" },
              label: "Criadas",
              color: "orange",
              mark: "line",
            },
          ],
          grouping: "day",
          period: LAST_30,
          habitFilter: ALL_HABITS,
          layout: { x: 0, y: 0, w: 2, h: 2 },
        },
        {
          id: "tasks-on-time",
          title: "No prazo",
          chart: "number",
          series: [
            {
              metric: { variable: "tasks.completedOnTime", divideBy: "tasks.completedWithDueDate" },
              label: "Concluídas no prazo",
              color: "aqua",
            },
          ],
          grouping: "none",
          period: LAST_30,
          habitFilter: ALL_HABITS,
          layout: { x: 2, y: 0, w: 1, h: 1 },
        },
        {
          id: "tasks-status",
          title: "Situação",
          chart: "donut",
          series: [
            { metric: { variable: "tasks.openPending" }, label: "No prazo", color: "blue" },
            { metric: { variable: "tasks.openOverdue" }, label: "Atrasadas", color: "orange" },
            { metric: { variable: "tasks.openWithoutDueDate" }, label: "Sem prazo", color: "aqua" },
            {
              metric: { variable: "tasks.completed" },
              label: "Concluídas em 30 dias",
              color: "violet",
            },
          ],
          grouping: "none",
          period: LAST_30,
          habitFilter: ALL_HABITS,
          layout: { x: 3, y: 0, w: 1, h: 2 },
        },
        {
          id: "tasks-next-7-days",
          title: "Próximos 7 dias",
          chart: "bar",
          series: [
            { metric: { variable: "tasks.openPending" }, label: "Com prazo no dia", color: "blue" },
          ],
          grouping: "day",
          period: { kind: "next", days: 7 },
          habitFilter: ALL_HABITS,
          layout: { x: 2, y: 1, w: 1, h: 1 },
        },
      ],
    },
    {
      id: "habits",
      title: "Hábitos",
      widgets: [
        {
          id: "habits-last-30-days",
          title: "Últimos 30 dias",
          chart: "bar",
          stacked: true,
          series: [
            { metric: { variable: "habits.completed" }, label: "Feitos", color: "done" },
            { metric: { variable: "habits.notCompleted" }, label: "Não feitos", color: "missed" },
            { metric: { variable: "habits.pending" }, label: "Pendentes", color: "pending" },
          ],
          grouping: "day",
          period: LAST_30,
          habitFilter: ALL_HABITS,
          layout: { x: 0, y: 0, w: 2, h: 2 },
        },
        {
          id: "habits-per-habit",
          title: "Por hábito",
          chart: "list",
          series: [
            { metric: { variable: "habits.completionRate" }, label: "Conclusão", color: "done" },
            {
              metric: { variable: "habits.currentStreak" },
              label: "Sequência atual",
              color: "blue",
            },
          ],
          grouping: "habit",
          period: LAST_30,
          habitFilter: ALL_HABITS,
          layout: { x: 2, y: 0, w: 2, h: 2 },
        },
      ],
    },
    {
      id: "trends",
      title: "Tendências",
      widgets: [
        {
          id: "trends-90-day-map",
          title: "Mapa de 90 dias",
          chart: "heatmap",
          series: [
            {
              metric: { variable: "habits.completionRate" },
              label: "Conclusão dos hábitos",
              color: "done",
            },
          ],
          grouping: "day",
          period: LAST_90,
          habitFilter: ALL_HABITS,
          layout: { x: 0, y: 0, w: 2, h: 1 },
        },
        {
          id: "trends-weekday",
          title: "Por dia da semana",
          chart: "bar",
          series: [
            {
              metric: { variable: "habits.completionRate" },
              label: "Conclusão dos hábitos",
              color: "blue",
            },
          ],
          grouping: "weekday",
          period: LAST_90,
          habitFilter: ALL_HABITS,
          layout: { x: 2, y: 0, w: 2, h: 1 },
        },
      ],
    },
  ],
};
