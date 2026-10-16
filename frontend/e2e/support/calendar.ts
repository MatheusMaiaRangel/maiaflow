import { expect, type Locator, type Page } from "@playwright/test";
import { dayAndMonth, dateWithWeekday, isSameMonth } from "./dates";
import { openPage } from "./navigation";
import { expectApiCall } from "./network";

const OCCURRENCE_STATUS_PATH = /^\/api\/habits\/occurrences\/\d+\/status$/;

export const FUTURE_DAY_REASON = "Ainda não chegou o dia";

export const STATUS_LABELS = ["Feito", "Não feito", "Pendente"] as const;

export type StatusLabel = (typeof STATUS_LABELS)[number];

export function openCalendar(page: Page): Promise<void> {
  return openPage(page, "/calendar", "Calendário");
}

export function calendarGrid(page: Page): Locator {
  return page.getByRole("grid", { name: "Calendário de hábitos" });
}

/** The button of a day in the grid, labelled like "15 de outubro, 1 hábito, 1 feito". */
export function dayCell(page: Page, day: string): Locator {
  return calendarGrid(page).getByRole("button", { name: new RegExp(`^${dayAndMonth(day)},`) });
}

/** The panel below the grid for the selected day (a region named by its heading). */
export function dayPanel(page: Page, day: string): Locator {
  return page.getByRole("region", { name: dateWithWeekday(day) });
}

/** The Feito / Não feito / Pendente group of a habit. */
export function statusGroup(scope: Page | Locator, habitTitle: string): Locator {
  return scope.getByRole("group", { name: `Status de ${habitTitle}`, exact: true });
}

export async function expectSelectedStatus(group: Locator, selected: StatusLabel): Promise<void> {
  for (const label of STATUS_LABELS) {
    await expect(group.getByRole("button", { name: label, exact: true })).toHaveAttribute(
      "aria-pressed",
      String(label === selected),
    );
  }
}

/**
 * Selects `day`, a day after `today`. When it falls in the next month the grid moves there first
 * (the next month opens with its first day selected, which is then `day` itself or before it).
 */
export async function selectFutureDay(page: Page, today: string, day: string): Promise<void> {
  if (!isSameMonth(today, day)) {
    await page.getByRole("button", { name: "Próximo mês" }).click();
  }
  await dayCell(page, day).click();
  await expect(dayPanel(page, day)).toBeVisible();
}

/** Picks a status in the group and waits until the API saved it (the UI updates optimistically). */
export async function chooseStatus(group: Locator, label: StatusLabel): Promise<void> {
  await expectApiCall(group.page(), "PATCH", OCCURRENCE_STATUS_PATH, () =>
    group.getByRole("button", { name: label, exact: true }).click(),
  );
}
