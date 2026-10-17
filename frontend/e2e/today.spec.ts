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
import type { Locator, Page } from "@playwright/test";

const HABIT = "Ler 10 páginas";
const PHONE = { width: 375, height: 812 };

function region(page: Page, name: string): Locator {
  return page.getByRole("region", { name, exact: true });
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
    // A new account has no habits: the charts invite to create one.
    await expect(summary).toContainText("Nada para mostrar ainda");
    await expect(summary.getByRole("link", { name: "Criar hábito" })).toHaveAttribute(
      "href",
      "/habits",
    );

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
    await expect(byHabit.getByRole("listitem").filter({ hasText: HABIT })).toContainText("100%");
    await expect(byHabit).toContainText("Sequência atual: 1 seguida");
    await expect(statCard(page, "Maior sequência")).toContainText("1 seguida");
    // The calendar's panel for today shows the same occurrence.
    await expectSelectedStatus(statusGroup(dayPanel(page, today), HABIT), "Feito");

    await page.reload();
    await expect(statCard(page, "Progresso do dia")).toContainText("1 de 1 concluídos");
  });

  test("puts the calendar before today's habits on a phone, without sideways scroll", async ({
    signedInPage: page,
  }) => {
    await page.setViewportSize(PHONE);
    await openPage(page, "/", "Hoje");

    const calendar = await box(region(page, "Calendário"));
    const habits = await box(region(page, "Hábitos de hoje"));
    expect(calendar.y + calendar.height).toBeLessThanOrEqual(habits.y);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
