import { randomBytes } from "node:crypto";
import { expect, test as base, type Locator, type Page } from "@playwright/test";

/** An account that exists only for the duration of one test. */
export type Account = {
  name: string;
  email: string;
  password: string;
  /** True once the account was created in the app and until it is deleted; the cleanup only acts then. */
  exists: boolean;
};

const DEFAULT_NAME = "Ana Souza";

function randomId(bytes = 8): string {
  return randomBytes(bytes).toString("hex");
}

export function newAccount(overrides: Partial<Pick<Account, "name">> = {}): Account {
  return {
    name: overrides.name ?? DEFAULT_NAME,
    email: `e2e-${randomId()}@example.test`,
    password: newPassword(),
    exists: false,
  };
}

/** A random password that satisfies the app's rules. */
export function newPassword(): string {
  return `E2e-${randomId(6)}!`;
}

/** Fills and submits the sign-up form (it does not wait for the result). */
export async function submitSignUp(page: Page, account: Account): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Nome").fill(account.name);
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Senha", { exact: true }).fill(account.password);
  await page.getByLabel("Confirmar senha").fill(account.password);
  await page.getByRole("button", { name: "Criar conta" }).click();
}

/** Signs the account up through the UI and waits for the Today screen. */
export async function registerAccount(page: Page, account: Account): Promise<void> {
  await submitSignUp(page, account);
  await expectOnTodayScreen(page);
  account.exists = true;
}

/** Fills and submits the login form (it does not wait for the result). */
export async function logIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await fillLoginForm(page, email, password);
}

/** Fills and submits the login form already on screen. */
export async function fillLoginForm(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function expectOnTodayScreen(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Hoje" })).toBeVisible();
}

/**
 * Error messages shown inside forms (server alert on top or the inline error of a field). Scoped to the
 * forms because Next.js also renders an always-present, empty `role="alert"` route announcer.
 */
export function formAlert(page: Page): Locator {
  return page.locator("form").getByRole("alert");
}

const DELETED_STATUSES = new Set([200, 204, 404]);

/**
 * Deletes the account through the app's same-origin proxy, reusing the browser session. When the test
 * left the browser signed out, it signs in again first. Deleting the account removes its tasks and habits.
 */
async function deleteAccount(page: Page, account: Account, baseURL: string): Promise<void> {
  if (!account.exists) return;
  const remove = () =>
    page
      .context()
      .request.delete("/api/users/me", { headers: { origin: new URL(baseURL).origin } });

  let response = await remove();
  if (response.status() === 401) {
    await logIn(page, account.email, account.password);
    await expectOnTodayScreen(page);
    response = await remove();
  }
  if (!DELETED_STATUSES.has(response.status())) {
    throw new Error(`Could not delete the E2E account ${account.email}: HTTP ${response.status()}`);
  }
  account.exists = false;
}

/** How Chromium reports a Content-Security-Policy violation in the console. */
const CSP_VIOLATION = /Content Security Policy|Content-Security-Policy/i;

type Fixtures = {
  /** A new, unique account. It is deleted after the test (with all its data), whatever the test did. */
  account: Account;
  /** A page already signed up and signed in as `account`, showing the Today screen. */
  signedInPage: Page;
  /** Console errors of the page during the test (CSP violations, hydration errors, uncaught errors). */
  consoleErrors: string[];
  /** Runs in every test: fails it when the browser reported a Content-Security-Policy violation. */
  noCspViolations: void;
};

export const test = base.extend<Fixtures>({
  account: async ({ page, baseURL }, provide) => {
    const account = newAccount();
    await provide(account);
    await deleteAccount(page, account, baseURL ?? "");
  },

  signedInPage: async ({ page, account }, provide) => {
    await registerAccount(page, account);
    await provide(page);
  },

  consoleErrors: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(`Uncaught: ${error.message}`));
    await provide(errors);
  },

  noCspViolations: [
    async ({ consoleErrors }, provide) => {
      await provide();
      const violations = consoleErrors.filter((text) => CSP_VIOLATION.test(text));
      expect(violations, "the browser reported Content-Security-Policy violations").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
