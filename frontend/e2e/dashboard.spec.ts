/**
 * The dashboard builder (phase 7, D26–D30): build, edit, move and delete widgets on the Today screen, and
 * find them again in another browser signed in as the same user. Every test also fails on a CSP violation
 * (fixture `noCspViolations`), which covers the drag-and-drop grid under the nonce policy (D22).
 */
import { expect, fillLoginForm, test, expectOnTodayScreen } from "./support/fixtures";
import type { Browser, Locator, Page } from "@playwright/test";

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 375, height: 812 };

function summary(page: Page): Locator {
  return page.getByRole("region", { name: "Resumo", exact: true });
}

function widget(page: Page, title: string): Locator {
  return summary(page).getByRole("region", { name: title, exact: true });
}

function movable(page: Page, title: string): Locator {
  return summary(page).getByRole("group", { name: new RegExp(`^${title}: coluna`) });
}

async function startEditing(page: Page) {
  await summary(page).getByRole("button", { name: "Editar painel" }).click();
  await expect(summary(page).getByRole("button", { name: "Concluir" })).toBeVisible();
}

async function finishEditing(page: Page) {
  await summary(page).getByRole("button", { name: "Concluir" }).click();
  await expect(summary(page).getByRole("button", { name: "Editar painel" })).toBeVisible();
}

/** Waits for the save the last change started. */
function saved(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/dashboard") && response.request().method() === "PUT",
  );
}

async function choose(scope: Locator, label: string, option: string) {
  await scope.getByRole("combobox", { name: label }).click();
  await scope.page().getByRole("option", { name: option, exact: true }).click();
}

/** A second device: a fresh browser context signed in as the same user. */
async function otherDevice(browser: Browser, email: string, password: string): Promise<Page> {
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  await page.goto("/login");
  await fillLoginForm(page, email, password);
  await expectOnTodayScreen(page);
  return page;
}

test.describe("dashboard builder", () => {
  test.use({ viewport: DESKTOP });

  test("builds a widget with the guided editor and finds it on another device", async ({
    signedInPage: page,
    account,
    browser,
  }) => {
    await startEditing(page);
    await summary(page).getByRole("button", { name: "Adicionar gráfico" }).click();

    const dialog = page.getByRole("dialog", { name: "Novo gráfico" });
    await dialog.getByLabel("Título").fill("Pontualidade");
    await dialog.getByRole("button", { name: "Número" }).click();
    await choose(dialog, "O que medir", "Concluídas no prazo");
    await dialog.getByText("Dividir por outra métrica (A ÷ B em %)").click();
    await choose(dialog, "Dividir por", "Concluídas com prazo");
    await choose(dialog, "Seção", "Hábitos");
    await dialog.getByRole("group", { name: "Fundo do card" }).getByText("Personalizada").click();
    await dialog
      .getByRole("group", { name: "Fundo do card" })
      .getByLabel("Cor hex")
      .fill("#2a78d6");
    const preview = dialog.getByRole("region", { name: "Pontualidade" });
    await expect(preview).toBeVisible();
    await expect(preview).toContainText("—");

    const save = saved(page);
    await dialog.getByRole("button", { name: "Salvar" }).click();
    expect((await save).status()).toBe(200);
    await expect(dialog).toBeHidden();
    await finishEditing(page);

    const habits = summary(page).getByRole("region", { name: "Hábitos", exact: true });
    await expect(habits.getByRole("region", { name: "Pontualidade", exact: true })).toBeVisible();

    const other = await otherDevice(browser, account.email, account.password);
    await expect(widget(other, "Pontualidade")).toBeVisible();
    await other.context().close();
  });

  test("moves and resizes a widget with the keyboard and keeps it after a reload", async ({
    signedInPage: page,
  }) => {
    await startEditing(page);
    const card = movable(page, "Concluídas por dia");
    await expect(card).toHaveAccessibleName(/coluna 1, linha 1, 2 de largura por 2 de altura/);

    await card.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    const save = saved(page);
    await page.keyboard.press("Enter");
    expect((await save).status()).toBe(200);
    await expect(card).toHaveAccessibleName(/coluna 3, linha 1, 2 de largura por 3 de altura/);

    await page.reload();
    await startEditing(page);
    await expect(movable(page, "Concluídas por dia")).toHaveAccessibleName(
      /coluna 3, linha 1, 2 de largura por 3 de altura/,
    );
  });

  test("drags a widget by its handle", async ({ signedInPage: page }) => {
    await startEditing(page);
    const card = movable(page, "Por dia da semana");
    await expect(card).toHaveAccessibleName(/coluna 3, linha 1/);
    const handle = card.locator(".dashboard-drag-handle");
    await card.scrollIntoViewIfNeeded();
    const from = await handle.boundingBox();
    const target = await movable(page, "Mapa de 90 dias").boundingBox();
    if (!from || !target) throw new Error("widgets are not visible");

    const save = saved(page);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + 20, target.y + 20, { steps: 12 });
    await page.mouse.up();
    expect((await save).status()).toBe(200);

    await expect(movable(page, "Por dia da semana")).toHaveAccessibleName(/coluna 1/);
  });

  test("deletes a widget and restores the default dashboard", async ({ signedInPage: page }) => {
    await startEditing(page);
    await summary(page).getByRole("button", { name: "Excluir No prazo" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("“No prazo” sai do painel em todos os aparelhos.");
    const save = saved(page);
    await confirm.getByRole("button", { name: "Excluir" }).click();
    expect((await save).status()).toBe(200);
    await finishEditing(page);
    await expect(widget(page, "No prazo")).toHaveCount(0);

    await page.reload();
    await expect(widget(page, "No prazo")).toHaveCount(0);

    await startEditing(page);
    await summary(page).getByRole("button", { name: "Restaurar padrão" }).click();
    const reset = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/dashboard") && response.request().method() === "DELETE",
    );
    await page.getByRole("alertdialog").getByRole("button", { name: "Restaurar" }).click();
    expect((await reset).status()).toBe(204);
    await finishEditing(page);
    await expect(widget(page, "No prazo")).toBeVisible();

    await page.reload();
    await expect(widget(page, "No prazo")).toBeVisible();
  });

  test("adds, renames and removes a section", async ({ signedInPage: page }) => {
    await startEditing(page);
    await summary(page).getByRole("button", { name: "Adicionar seção" }).click();
    await page.getByRole("dialog").getByLabel("Nome da seção").fill("Metas");
    let save = saved(page);
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    expect((await save).status()).toBe(200);

    await summary(page).getByRole("button", { name: "Renomear a seção Metas" }).click();
    await page.getByRole("dialog").getByLabel("Nome da seção").fill("Objetivos");
    save = saved(page);
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    expect((await save).status()).toBe(200);
    await expect(
      summary(page).getByRole("region", { name: "Objetivos", exact: true }),
    ).toBeVisible();

    save = saved(page);
    await summary(page).getByRole("button", { name: "Excluir a seção Objetivos" }).click();
    expect((await save).status()).toBe(200);
    await expect(summary(page).getByRole("region", { name: "Objetivos", exact: true })).toHaveCount(
      0,
    );
  });
});

test.describe("dashboard builder on a phone", () => {
  test.use({ viewport: PHONE });

  test("reorders widgets in one column without sideways scroll", async ({ signedInPage: page }) => {
    await startEditing(page);
    const tasks = summary(page).getByRole("region", { name: "Tarefas", exact: true });
    await expect(tasks.getByRole("button", { name: "Subir Concluídas por dia" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    const save = saved(page);
    await tasks.getByRole("button", { name: "Descer Concluídas por dia" }).click();
    expect((await save).status()).toBe(200);
    await expect(tasks.getByRole("button", { name: "Subir Concluídas por dia" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await finishEditing(page);
    const order = await tasks
      .getByRole("region")
      .evaluateAll((cards) => cards.map((card) => card.querySelector("h3")?.textContent));
    expect(order.slice(0, 2)).toEqual(["No prazo", "Concluídas por dia"]);
  });
});
