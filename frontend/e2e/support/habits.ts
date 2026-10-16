import { expect, type Locator, type Page } from "@playwright/test";
import { openPage } from "./navigation";

/** Labels of the "Frequência" select, by API frequency type. */
export const FREQUENCY_LABELS = {
  Daily: "Todos os dias",
  Weekly: "Toda semana",
  Monthly: "Todo mês",
  Yearly: "Todo ano",
  IntervalDays: "A cada N dias",
  SpecificDaysOfWeek: "Dias da semana específicos",
} as const;

export type FrequencyType = keyof typeof FREQUENCY_LABELS;

export type RecurrenceInput = {
  frequency: FrequencyType;
  /** IntervalDays only. */
  intervalDays?: number;
  /** SpecificDaysOfWeek only: full names as the toggle buttons are labelled, e.g. "Segunda-feira". */
  weekdays?: string[];
  /** Monthly only. */
  monthDays?: number[];
  /** Monthly only: ticks "Último dia do mês". */
  lastDayOfMonth?: boolean;
};

export type HabitInput = RecurrenceInput & {
  title: string;
  description?: string;
};

export function openHabits(page: Page): Promise<void> {
  return openPage(page, "/habits", "Hábitos");
}

/** The card of a habit in the "Seus hábitos" list. */
export function habitCard(page: Page, title: string): Locator {
  return page
    .getByRole("list", { name: "Seus hábitos" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: `Editar hábito ${title}`, exact: true }) });
}

/** Picks the frequency and fills the inputs that frequency needs, inside an open habit dialog. */
export async function fillRecurrence(dialog: Locator, recurrence: RecurrenceInput): Promise<void> {
  const page = dialog.page();
  await dialog.getByRole("combobox", { name: "Frequência" }).click();
  await page
    .getByRole("option", { name: FREQUENCY_LABELS[recurrence.frequency], exact: true })
    .click();
  await expect(dialog.getByRole("combobox", { name: "Frequência" })).toContainText(
    FREQUENCY_LABELS[recurrence.frequency],
  );

  if (recurrence.intervalDays !== undefined) {
    await dialog.getByLabel("Repetir a cada (dias)").fill(String(recurrence.intervalDays));
  }
  for (const weekday of recurrence.weekdays ?? []) {
    await toggleOn(dialog.getByRole("button", { name: weekday, exact: true }));
  }
  for (const day of recurrence.monthDays ?? []) {
    await toggleOn(dialog.getByRole("button", { name: `Dia ${day}`, exact: true }));
  }
  if (recurrence.lastDayOfMonth) {
    await dialog.getByRole("checkbox", { name: "Último dia do mês" }).check();
  }
}

async function toggleOn(toggle: Locator): Promise<void> {
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
}

/** Creates a habit (starting today) from the "Novo hábito" button of /habits and waits for its card. */
export async function createHabit(page: Page, habit: HabitInput): Promise<void> {
  await page.getByRole("button", { name: "Novo hábito" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo hábito" });
  await dialog.getByLabel("Título").fill(habit.title);
  if (habit.description) await dialog.getByLabel("Descrição (opcional)").fill(habit.description);
  await fillRecurrence(dialog, habit);
  await dialog.getByRole("button", { name: "Criar hábito" }).click();

  await expect(dialog).toBeHidden();
  await expect(habitCard(page, habit.title)).toBeVisible();
}
