import {
  FUTURE_DAY_REASON,
  STATUS_LABELS,
  chooseStatus,
  dayCell,
  dayPanel,
  expectSelectedStatus,
  openCalendar,
  selectFutureDay,
  statusGroup,
} from "./support/calendar";
import { addDays, dayAndMonth, todayInBrasilia } from "./support/dates";
import { expect, test } from "./support/fixtures";
import { createHabit, openHabits } from "./support/habits";
import { openPage } from "./support/navigation";

const HABIT = "Alongar";

test.describe("habit calendar", () => {
  test.beforeEach(async ({ signedInPage: page }) => {
    await openHabits(page);
    await createHabit(page, { title: HABIT, frequency: "Daily" });
    await openCalendar(page);
  });

  test("marks today's occurrence as done and as not done", async ({ signedInPage: page }) => {
    const today = todayInBrasilia();
    const panel = dayPanel(page, today);
    const group = statusGroup(panel, HABIT);
    await expect(dayCell(page, today)).toHaveAttribute("aria-current", "date");
    await expectSelectedStatus(group, "Pendente");

    await chooseStatus(group, "Feito");
    await expectSelectedStatus(group, "Feito");
    await expect(dayCell(page, today)).toHaveAccessibleName(
      `${dayAndMonth(today)}, 1 hábito, 1 feito`,
    );

    await page.reload();
    await expectSelectedStatus(statusGroup(dayPanel(page, today), HABIT), "Feito");

    await chooseStatus(statusGroup(dayPanel(page, today), HABIT), "Não feito");
    await expectSelectedStatus(statusGroup(dayPanel(page, today), HABIT), "Não feito");
    await expect(dayCell(page, today)).toHaveAccessibleName(
      `${dayAndMonth(today)}, 1 hábito, 1 não feito`,
    );

    // The Today screen reads the same occurrence.
    await openPage(page, "/", "Hoje");
    const todayHabits = page.getByRole("region", { name: "Hábitos de hoje" });
    await expectSelectedStatus(statusGroup(todayHabits, HABIT), "Não feito");
    await expect(todayHabits).toContainText("0 de 1 feitos");
  });

  test("shows a future day with its controls disabled", async ({ signedInPage: page }) => {
    const today = todayInBrasilia();
    const tomorrow = addDays(today, 1);

    await selectFutureDay(page, today, tomorrow);

    const panel = dayPanel(page, tomorrow);
    await expect(panel).toContainText(`${FUTURE_DAY_REASON}.`);
    const group = statusGroup(panel, HABIT);
    for (const label of STATUS_LABELS) {
      await expect(group.getByRole("button", { name: label, exact: true })).toBeDisabled();
    }
    await expectSelectedStatus(group, "Pendente");
  });
});
