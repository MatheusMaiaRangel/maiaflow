import { expect, type Locator, type Page } from "@playwright/test";

/** The avatar button of the header ("Conta de <name>"); its text is the user's initials. */
export function userMenuButton(page: Page, name: string): Locator {
  return page.getByRole("button", { name: `Conta de ${name}`, exact: true });
}

/** Opens the account menu in the header. */
export async function openUserMenu(page: Page, name: string): Promise<void> {
  await userMenuButton(page, name).click();
}

/** Signs out through the account menu and waits for the login page. */
export async function logOut(page: Page, name: string): Promise<void> {
  await openUserMenu(page, name);
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/** Goes to a page of the app by its URL and waits for its heading. */
export async function openPage(page: Page, path: string, heading: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
}
