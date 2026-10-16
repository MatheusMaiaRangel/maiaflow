import { addDays, shortDate, todayInBrasilia } from "./support/dates";
import { expect, test } from "./support/fixtures";
import { openPage } from "./support/navigation";
import { expectApiCall } from "./support/network";
import {
  chooseTaskAction,
  createTask,
  filterTab,
  openTasks,
  taskCheckbox,
  taskList,
  taskRow,
} from "./support/tasks";

const STATUS_ENDPOINT = "**/api/tasks/*/status";
const STATUS_PATH = /^\/api\/tasks\/\d+\/status$/;
const TASK_PATH = /^\/api\/tasks\/\d+$/;

test.describe("tasks", () => {
  test("creates a task and shows a task due today on the Today screen", async ({
    signedInPage: page,
  }) => {
    await openTasks(page);
    await expect(page.getByText("Nenhuma tarefa ainda")).toBeVisible();

    await createTask(page, {
      title: "Pagar conta de luz",
      description: "Vence hoje",
      dueDate: todayInBrasilia(),
    });

    await expect(page.getByText("Tarefa criada.")).toBeVisible();
    const row = taskRow(page, "Pagar conta de luz");
    await expect(row).toContainText("Vence hoje");
    await expect(row).toContainText("Hoje");
    await expect(filterTab(page, "Todas", 1)).toBeVisible();
    await expect(filterTab(page, "Pendentes", 1)).toBeVisible();

    await openPage(page, "/", "Hoje");
    const todayTasks = page.getByRole("region", { name: "Tarefas de hoje" });
    await expect(todayTasks.getByRole("checkbox", { name: "Pagar conta de luz" })).toBeVisible();
    await expect(todayTasks).toContainText("0 de 1 feitas");
  });

  test("completes a task optimistically, before the server answers", async ({
    signedInPage: page,
  }) => {
    await openTasks(page);
    await createTask(page, { title: "Comprar pão" });

    let releaseRequest: () => void = () => {};
    const requestReleased = new Promise<void>((resolve) => (releaseRequest = resolve));
    await page.route(STATUS_ENDPOINT, async (route) => {
      await requestReleased;
      await route.continue();
    });

    const checkbox = taskCheckbox(page, "Comprar pão");
    await checkbox.click();

    // The request is still held: what shows now is the optimistic update.
    await expect(checkbox).toBeChecked();
    await expect(filterTab(page, "Concluídas", 1)).toBeVisible();

    await expectApiCall(page, "PATCH", STATUS_PATH, async () => releaseRequest());
    await page.unroute(STATUS_ENDPOINT);

    await page.reload();
    await expect(taskCheckbox(page, "Comprar pão")).toBeChecked();
    await expect(filterTab(page, "Concluídas", 1)).toBeVisible();

    await expectApiCall(page, "PATCH", STATUS_PATH, () =>
      taskCheckbox(page, "Comprar pão").click(),
    );
    await expect(taskCheckbox(page, "Comprar pão")).not.toBeChecked();
    await expect(filterTab(page, "Pendentes", 1)).toBeVisible();
  });

  test("edits the title, description and due date of a task", async ({ signedInPage: page }) => {
    const nextWeek = addDays(todayInBrasilia(), 7);
    await openTasks(page);
    await createTask(page, { title: "Estudar", description: "Capítulo 1" });

    await chooseTaskAction(page, "Estudar", "Editar");
    const dialog = page.getByRole("dialog", { name: "Editar tarefa" });
    await expect(dialog.getByLabel("Título")).toHaveValue("Estudar");
    await dialog.getByLabel("Título").fill("Estudar inglês");
    await dialog.getByLabel("Descrição (opcional)").fill("Capítulo 2");
    await dialog.getByLabel("Prazo (opcional)").fill(nextWeek);
    await dialog.getByRole("button", { name: "Salvar" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("Tarefa atualizada.")).toBeVisible();
    const row = taskRow(page, "Estudar inglês");
    await expect(row).toContainText("Capítulo 2");
    await expect(row).toContainText(shortDate(nextWeek));
    await expect(taskCheckbox(page, "Estudar")).toHaveCount(0);

    await page.reload();
    await expect(taskRow(page, "Estudar inglês")).toContainText("Capítulo 2");
  });

  test("marks a task as not completed from its menu", async ({ signedInPage: page }) => {
    await openTasks(page);
    await createTask(page, { title: "Ligar para o banco" });

    await expectApiCall(page, "PATCH", STATUS_PATH, () =>
      chooseTaskAction(page, "Ligar para o banco", "Marcar como não concluída"),
    );

    await expect(taskRow(page, "Ligar para o banco")).toContainText("Não concluída");
    await expect(filterTab(page, "Não concluídas", 1)).toBeVisible();
  });

  test("deletes a task only after the confirmation", async ({ signedInPage: page }) => {
    await openTasks(page);
    await createTask(page, { title: "Lavar o carro" });
    await createTask(page, { title: "Regar as plantas" });

    await chooseTaskAction(page, "Lavar o carro", "Excluir");
    const confirm = page.getByRole("alertdialog", { name: "Excluir tarefa?" });
    await expect(confirm).toContainText('"Lavar o carro" será excluída.');
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(confirm).toBeHidden();
    await expect(taskRow(page, "Lavar o carro")).toBeVisible();

    await chooseTaskAction(page, "Lavar o carro", "Excluir");
    await expectApiCall(page, "DELETE", TASK_PATH, () =>
      confirm.getByRole("button", { name: "Excluir" }).click(),
    );

    await expect(confirm).toBeHidden();
    await expect(taskRow(page, "Lavar o carro")).toHaveCount(0);
    await expect(filterTab(page, "Todas", 1)).toBeVisible();

    await page.reload();
    await expect(taskList(page).getByRole("listitem")).toHaveCount(1);
    await expect(taskRow(page, "Regar as plantas")).toBeVisible();
  });
});
