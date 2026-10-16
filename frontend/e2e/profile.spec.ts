import {
  expect,
  expectOnTodayScreen,
  formAlert,
  logIn,
  newPassword,
  test,
} from "./support/fixtures";
import { logOut, openPage, userMenuButton } from "./support/navigation";

test.describe("profile", () => {
  test.beforeEach(async ({ signedInPage: page, account }) => {
    await openPage(page, "/profile", "Perfil");
    // The form fills its fields when it hydrates; typing before that would mix both values.
    await expect(page.getByLabel("Nome")).toHaveValue(account.name);
  });

  test("edits the name and the header initials follow", async ({ signedInPage: page, account }) => {
    await expect(userMenuButton(page, account.name)).toHaveText("AS");

    await page.getByLabel("Nome").fill("Bruno de Lima");
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page.getByText("Dados atualizados.")).toBeVisible();
    account.name = "Bruno de Lima";
    await expect(userMenuButton(page, "Bruno de Lima")).toHaveText("BL");

    await page.reload();
    await expect(page.getByLabel("Nome")).toHaveValue("Bruno de Lima");
    await expect(userMenuButton(page, "Bruno de Lima")).toHaveText("BL");
  });

  test("changes the password and logs in with the new one", async ({
    signedInPage: page,
    account,
  }) => {
    const oldPassword = account.password;
    const password = newPassword();

    await page.getByLabel("Nova senha", { exact: true }).fill(password);
    await page.getByLabel("Confirmar nova senha").fill(password);
    await page.getByRole("button", { name: "Alterar senha" }).click();

    await expect(page.getByText("Senha alterada.")).toBeVisible();
    account.password = password;
    await expect(page.getByLabel("Nova senha", { exact: true })).toHaveValue("");

    await logOut(page, account.name);
    await logIn(page, account.email, oldPassword);
    await expect(formAlert(page)).toHaveText("E-mail ou senha inválidos.");

    await logIn(page, account.email, password);
    await expectOnTodayScreen(page);
  });

  test("deletes the account after the confirmation", async ({ signedInPage: page, account }) => {
    await page.getByRole("button", { name: "Excluir minha conta" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Excluir sua conta?" });
    await expect(confirm).toContainText("serão apagados para sempre");
    await confirm.getByRole("button", { name: "Excluir conta" }).click();

    await expect(page).toHaveURL(/\/login\?reason=deleted$/);
    await expect(
      page.getByRole("status").filter({ hasText: "Sua conta foi excluída." }),
    ).toBeVisible();
    account.exists = false;

    await logIn(page, account.email, account.password);
    await expect(formAlert(page)).toHaveText("E-mail ou senha inválidos.");
  });
});
