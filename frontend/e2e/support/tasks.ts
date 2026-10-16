import { expect, type Locator, type Page } from "@playwright/test";
import { openPage } from "./navigation";

export type TaskInput = {
  title: string;
  description?: string;
  /** `yyyy-MM-dd` */
  dueDate?: string;
};

export function openTasks(page: Page): Promise<void> {
  return openPage(page, "/tasks", "Tarefas");
}

export function taskList(page: Page): Locator {
  return page.getByRole("list", { name: "Lista de tarefas" });
}

/** The list item of a task, found by its checkbox (labelled with the exact title). */
export function taskRow(page: Page, title: string): Locator {
  return taskList(page)
    .getByRole("listitem")
    .filter({ has: page.getByRole("checkbox", { name: title, exact: true }) });
}

export function taskCheckbox(page: Page, title: string): Locator {
  return taskList(page).getByRole("checkbox", { name: title, exact: true });
}

/** Creates a task from the "Nova tarefa" button of /tasks and waits for it in the list. */
export async function createTask(page: Page, task: TaskInput): Promise<void> {
  await page.getByRole("button", { name: "Nova tarefa" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova tarefa" });
  await dialog.getByLabel("Título").fill(task.title);
  if (task.description) await dialog.getByLabel("Descrição (opcional)").fill(task.description);
  if (task.dueDate) await dialog.getByLabel("Prazo (opcional)").fill(task.dueDate);
  await dialog.getByRole("button", { name: "Salvar" }).click();

  await expect(dialog).toBeHidden();
  await expect(taskRow(page, task.title)).toBeVisible();
}

/** Opens the "⋮" menu of a task and picks one of its items. */
export async function chooseTaskAction(page: Page, title: string, action: string): Promise<void> {
  await page.getByRole("button", { name: `Ações da tarefa ${title}`, exact: true }).click();
  await page.getByRole("menuitem", { name: action }).click();
}

/** The status filter tab, whose accessible name carries the count, e.g. "Concluídas (1)". */
export function filterTab(page: Page, label: string, count: number): Locator {
  return page.getByRole("tab", { name: `${label} (${count})`, exact: true });
}
