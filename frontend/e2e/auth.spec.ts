import {
  expect,
  expectOnTodayScreen,
  fillLoginForm,
  formAlert,
  logIn,
  newAccount,
  registerAccount,
  submitSignUp,
  test,
} from "./support/fixtures";
import { logOut } from "./support/navigation";

test.describe("sign-up and login", () => {
  test("sign-up creates the account and lands on the Today screen", async ({ page, account }) => {
    await registerAccount(page, account);

    await expect(page.getByRole("button", { name: `Conta de ${account.name}` })).toBeVisible();
    // Scoped to the lists: the calendar and the summary on the same screen have their own empty states.
    await expect(
      page.getByRole("region", { name: "Hábitos de hoje" }).getByText("Nenhum hábito para hoje"),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Tarefas de hoje" }).getByText("Nenhuma tarefa para hoje"),
    ).toBeVisible();
  });

  test("logging out ends the session and protects the app again", async ({ page, account }) => {
    await registerAccount(page, account);

    await logOut(page, account.name);
    await page.goto("/");

    await expect(page).toHaveURL(/\/login$/);
  });

  test("shows an error for a wrong password and keeps the user on the login page", async ({
    page,
    account,
  }) => {
    await registerAccount(page, account);
    await logOut(page, account.name);

    await logIn(page, account.email, `${account.password}-wrong`);

    await expect(formAlert(page)).toHaveText("E-mail ou senha inválidos.");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("shows the same error for an e-mail that has no account", async ({ page }) => {
    const stranger = newAccount();

    await logIn(page, stranger.email, stranger.password);

    await expect(formAlert(page)).toHaveText("E-mail ou senha inválidos.");
  });

  test("logs in with the right credentials", async ({ page, account }) => {
    await registerAccount(page, account);
    await logOut(page, account.name);

    await logIn(page, account.email, account.password);

    await expectOnTodayScreen(page);
    await expect(page.getByRole("button", { name: `Conta de ${account.name}` })).toBeVisible();
  });

  test("shows a duplicated e-mail under the e-mail field on sign-up", async ({ page, account }) => {
    await registerAccount(page, account);
    await logOut(page, account.name);
    const duplicate = { ...newAccount(), email: account.email };

    await submitSignUp(page, duplicate);

    const email = page.getByLabel("E-mail");
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription("Este e-mail já está cadastrado.");
    await expect(formAlert(page)).toHaveText("Este e-mail já está cadastrado.");
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("validates the sign-up form before calling the server", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Nome").fill("Al");
    await page.getByLabel("E-mail").fill("not-an-email");
    await page.getByLabel("Senha", { exact: true }).fill("12345");
    await page.getByLabel("Confirmar senha").fill("54321");
    await page.getByRole("button", { name: "Criar conta" }).click();

    await expect(page.getByText("O nome deve ter pelo menos 3 caracteres.")).toBeVisible();
    await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
    await expect(page.getByText("A senha deve ter pelo menos 6 caracteres.")).toBeVisible();
    await expect(page.getByText("As senhas não conferem.")).toBeVisible();
  });

  test("redirects an anonymous visit to /tasks to the login page and comes back after login", async ({
    page,
    account,
  }) => {
    await registerAccount(page, account);
    await logOut(page, account.name);

    await page.goto("/tasks");
    await expect(page).toHaveURL(/\/login\?next=%2Ftasks$/);

    await fillLoginForm(page, account.email, account.password);

    await expect(page).toHaveURL(/\/tasks$/);
    await expect(page.getByRole("heading", { level: 1, name: "Tarefas" })).toBeVisible();
  });
});
