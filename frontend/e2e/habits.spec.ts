import { dayAndMonth, everyWeekdaySummary, shortDate, todayInBrasilia } from "./support/dates";
import { expect, test } from "./support/fixtures";
import {
  createHabit,
  fillRecurrence,
  habitCard,
  openHabits,
  type HabitInput,
} from "./support/habits";

type CreationCase = {
  habit: HabitInput;
  /** The recurrence summary the card shows; a function when it depends on today. */
  summary: string | ((today: string) => string);
};

const CREATION_CASES: CreationCase[] = [
  {
    habit: { title: "Beber água", frequency: "Daily" },
    summary: "Todos os dias",
  },
  {
    habit: { title: "Faxina", frequency: "Weekly" },
    summary: (today) => everyWeekdaySummary(today),
  },
  {
    habit: {
      title: "Pagar contas",
      frequency: "Monthly",
      monthDays: [10, 20],
      lastDayOfMonth: true,
    },
    summary: "Todo mês, nos dias 10 e 20 e no último dia do mês",
  },
  {
    habit: { title: "Revisão anual", frequency: "Yearly" },
    summary: (today) => `Todo ano, em ${dayAndMonth(today)}`,
  },
  {
    habit: { title: "Regar as plantas", frequency: "IntervalDays", intervalDays: 3 },
    summary: "A cada 3 dias",
  },
  {
    habit: {
      title: "Academia",
      frequency: "SpecificDaysOfWeek",
      weekdays: ["Segunda-feira", "Quarta-feira", "Sexta-feira"],
    },
    summary: "Dias da semana: seg, qua e sex",
  },
];

test.describe("habits", () => {
  for (const { habit, summary } of CREATION_CASES) {
    test(`creates a ${habit.frequency} habit`, async ({ signedInPage: page }) => {
      const today = todayInBrasilia();
      const expected = typeof summary === "function" ? summary(today) : summary;
      await openHabits(page);

      await createHabit(page, { ...habit, description: `Hábito ${habit.frequency}` });

      await expect(page.getByText("Hábito criado.")).toBeVisible();
      const card = habitCard(page, habit.title);
      await expect(card).toContainText(expected);
      await expect(card).toContainText(`Hábito ${habit.frequency}`);
      await expect(card).toContainText(`Começou em ${shortDate(today)}`);

      await page.reload();
      await expect(habitCard(page, habit.title)).toContainText(expected);
    });
  }

  test("changes the recurrence of a habit", async ({ signedInPage: page }) => {
    await openHabits(page);
    await createHabit(page, { title: "Ler", frequency: "Daily" });
    await expect(habitCard(page, "Ler")).toContainText("Todos os dias");

    await page.getByRole("button", { name: "Alterar recorrência de Ler", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Alterar recorrência" });
    await expect(dialog.getByRole("combobox", { name: "Frequência" })).toContainText(
      "Todos os dias",
    );
    await fillRecurrence(dialog, {
      frequency: "SpecificDaysOfWeek",
      weekdays: ["Terça-feira", "Quinta-feira"],
    });
    await dialog.getByRole("button", { name: "Alterar recorrência", exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText(/^Recorrência alterada\. Vale a partir de/)).toBeVisible();
    await expect(habitCard(page, "Ler")).toContainText("Dias da semana: ter e qui");

    await page.reload();
    await expect(habitCard(page, "Ler")).toContainText("Dias da semana: ter e qui");
  });

  test("shows the validation errors of the recurrence fields", async ({ signedInPage: page }) => {
    await openHabits(page);
    await page.getByRole("button", { name: "Novo hábito" }).click();
    const dialog = page.getByRole("dialog", { name: "Novo hábito" });
    await dialog.getByLabel("Título").fill("Sem dias");
    await fillRecurrence(dialog, { frequency: "SpecificDaysOfWeek" });

    await dialog.getByRole("button", { name: "Criar hábito" }).click();

    await expect(dialog.getByRole("alert")).toHaveText("Escolha pelo menos um dia da semana.");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Nenhum hábito ainda")).toBeVisible();
  });

  test("deletes a habit after the confirmation", async ({ signedInPage: page }) => {
    await openHabits(page);
    await createHabit(page, { title: "Meditar", frequency: "Daily" });

    await page.getByRole("button", { name: "Excluir hábito Meditar", exact: true }).click();
    const confirm = page.getByRole("alertdialog", { name: "Excluir hábito?" });
    await expect(confirm).toContainText("“Meditar” será excluído junto com todo o histórico");
    await confirm.getByRole("button", { name: "Excluir" }).click();

    await expect(confirm).toBeHidden();
    await expect(page.getByText("Hábito excluído.")).toBeVisible();
    await expect(page.getByText("Nenhum hábito ainda")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Nenhum hábito ainda")).toBeVisible();
  });
});
