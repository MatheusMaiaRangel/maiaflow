import {
  calendarGrid,
  chooseStatus,
  dayCell,
  dayPanel,
  expectSelectedStatus,
  statusGroup,
} from "./support/calendar";
import { todayInBrasilia } from "./support/dates";
import { expect, test } from "./support/fixtures";
import { createHabit, openHabits } from "./support/habits";
import { openPage } from "./support/navigation";
import { createTask, openTasks } from "./support/tasks";
import type { Locator, Page } from "@playwright/test";

const HABIT = "Ler 10 páginas";
const TASK = "Pagar a conta de luz";

const DASHBOARD = {
  Tarefas: ["Concluídas por dia", "No prazo", "Situação", "Próximos 7 dias"],
  Hábitos: ["Últimos 30 dias", "Por hábito"],
  Tendências: ["Mapa de 90 dias", "Por dia da semana"],
};
const PHONE = { width: 375, height: 812 };

function region(page: Page, name: string): Locator {
  return page.getByRole("region", { name, exact: true });
}

function widget(page: Page, name: string): Locator {
  return region(page, "Resumo").getByRole("region", { name, exact: true });
}

function statCard(page: Page, name: string): Locator {
  return region(page, "Resumo").getByRole("group", { name, exact: true });
}

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (!found) throw new Error("element is not visible");
  return found;
}

test.describe("today screen", () => {
  test("shows the calendar, the lists and the summary", async ({ signedInPage: page }) => {
    const today = todayInBrasilia();

    await expect(region(page, "Calendário")).toBeVisible();
    await expect(calendarGrid(page)).toBeVisible();
    await expect(dayCell(page, today)).toHaveAttribute("aria-current", "date");
    await expect(region(page, "Hábitos de hoje")).toBeVisible();
    await expect(region(page, "Tarefas de hoje")).toBeVisible();

    const summary = region(page, "Resumo");
    await expect(summary).toBeVisible();
    for (const name of [
      "Progresso do dia",
      "Atrasadas",
      "Maior sequência",
      "Conclusão em 30 dias",
    ]) {
      await expect(statCard(page, name)).toBeVisible();
    }
    // The default dashboard below the cards, every widget in its section.
    for (const [section, widgets] of Object.entries(DASHBOARD)) {
      const sectionRegion = summary.getByRole("region", { name: section, exact: true });
      for (const name of widgets) {
        await expect(sectionRegion.getByRole("region", { name, exact: true })).toBeVisible();
      }
    }
    // A new account has nothing yet: the widgets point to the tasks and habits pages.
    await expect(
      widget(page, "Concluídas por dia").getByRole("link", { name: "Ver tarefas" }),
    ).toHaveAttribute("href", "/tasks");
    await expect(
      widget(page, "Últimos 30 dias").getByRole("link", { name: "Ver hábitos" }),
    ).toHaveAttribute("href", "/habits");

    // Desktop: lists on the left, calendar on the right, side by side.
    const calendar = await box(region(page, "Calendário"));
    const habits = await box(region(page, "Hábitos de hoje"));
    expect(calendar.x).toBeGreaterThan(habits.x + habits.width - 1);
    expect(Math.abs(calendar.y - habits.y)).toBeLessThan(calendar.height);
  });

  test("marking today's habit as done updates the summary", async ({ signedInPage: page }) => {
    const today = todayInBrasilia();
    await openHabits(page);
    await createHabit(page, { title: HABIT, frequency: "Daily" });
    await openPage(page, "/", "Hoje");

    const progress = statCard(page, "Progresso do dia");
    await expect(progress).toContainText("0%");
    await expect(progress).toContainText("0 de 1 concluídos");
    const byHabit = region(page, "Por hábito");
    await expect(byHabit).toContainText(HABIT);

    const todayHabits = region(page, "Hábitos de hoje");
    await chooseStatus(statusGroup(todayHabits, HABIT), "Feito");

    await expect(progress).toContainText("100%");
    await expect(progress).toContainText("1 de 1 concluídos");
    await expect(byHabit.getByRole("listitem").filter({ hasText: HABIT })).toContainText(
      "Conclusão: 100%",
    );
    await expect(byHabit).toContainText("Sequência atual: 1 seguida");
    await expect(widget(page, "Últimos 30 dias").getByRole("img")).toHaveAccessibleName(
      /Feitos: 1 no total\. Não feitos: 0 no total\. Pendentes: 0 no total\./,
    );
    await expect(widget(page, "Mapa de 90 dias").getByTitle(/: 100%$/)).toHaveCount(1);
    await expect(statCard(page, "Maior sequência")).toContainText("1 seguida");
    // The calendar's panel for today shows the same occurrence.
    await expectSelectedStatus(statusGroup(dayPanel(page, today), HABIT), "Feito");

    await page.reload();
    await expect(statCard(page, "Progresso do dia")).toContainText("1 de 1 concluídos");
  });

  test("completing a task fills the task widgets", async ({ signedInPage: page }) => {
    const today = todayInBrasilia();
    await openTasks(page);
    await createTask(page, { title: TASK, dueDate: today });
    await openPage(page, "/", "Hoje");

    await expect(widget(page, "Situação").getByRole("img")).toHaveAccessibleName(
      "Situação: No prazo: 1 no total. Atrasadas: 0 no total. Sem prazo: 0 no total. Concluídas em 30 dias: 0 no total.",
    );
    await expect(widget(page, "Próximos 7 dias").getByRole("img")).toHaveAccessibleName(
      /Com prazo no dia: 1 no total/,
    );

    await region(page, "Tarefas de hoje")
      .getByRole("checkbox", { name: TASK, exact: true })
      .click();

    await expect(widget(page, "No prazo")).toContainText("100%");
    await expect(widget(page, "No prazo")).toContainText("Concluídas no prazo: 1 de 1");
    await expect(widget(page, "Concluídas por dia").getByRole("img")).toHaveAccessibleName(
      "Concluídas por dia: Concluídas: 1 no total. Criadas: 1 no total.",
    );
    await expect(widget(page, "Situação").getByRole("img")).toHaveAccessibleName(
      /No prazo: 0 no total.*Concluídas em 30 dias: 1 no total\./,
    );

    // Reopening takes the completion back out.
    await region(page, "Tarefas de hoje")
      .getByRole("checkbox", { name: TASK, exact: true })
      .click();
    await expect(widget(page, "Concluídas por dia").getByRole("img")).toHaveAccessibleName(
      "Concluídas por dia: Concluídas: 0 no total. Criadas: 1 no total.",
    );
  });

  test("puts the calendar before today's habits on a phone, without sideways scroll", async ({
    signedInPage: page,
  }) => {
    await page.setViewportSize(PHONE);
    await openPage(page, "/", "Hoje");

    const calendar = await box(region(page, "Calendário"));
    const habits = await box(region(page, "Hábitos de hoje"));
    expect(calendar.y + calendar.height).toBeLessThanOrEqual(habits.y);

    // The dashboard is one column: widgets of a section stack.
    const first = await box(widget(page, "Concluídas por dia"));
    const second = await box(widget(page, "No prazo"));
    expect(second.x).toBe(first.x);
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
