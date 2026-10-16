import { expect, test } from "./support/fixtures";
import { logOut } from "./support/navigation";

const MAIN_PAGES = [
  { path: "/", heading: "Hoje" },
  { path: "/tasks", heading: "Tarefas" },
  { path: "/habits", heading: "Hábitos" },
  { path: "/calendar", heading: "Calendário" },
  { path: "/profile", heading: "Perfil" },
];

/** The production policy: scripts only with the per-request nonce, never inline or eval. */
function expectStrictPolicy(policy: string | undefined): void {
  expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'(;|$)/);
  expect(policy).not.toContain("unsafe-eval");
  expect(policy).toContain("frame-ancestors 'none'");
}

test.describe("pages under the Content-Security-Policy", () => {
  test("every main page renders with a nonce-based CSP and no console errors", async ({
    signedInPage: page,
    account,
    consoleErrors,
  }) => {
    const nonces = new Set<string>();

    for (const { path, heading } of MAIN_PAGES) {
      const response = await page.goto(path);
      const policy = response?.headers()["content-security-policy"];
      expectStrictPolicy(policy);
      nonces.add(/'nonce-([^']+)'/.exec(policy ?? "")?.[1] ?? "");

      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      // The theme script (inline, allowed only by the nonce) has applied a theme class.
      await expect(page.locator("html")).toHaveClass(/\b(light|dark)\b/);
    }

    await logOut(page, account.name);
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();

    expect(nonces.size, "a fresh nonce on every request").toBe(MAIN_PAGES.length);
    expect(consoleErrors).toEqual([]);
  });

  test("the sign-in pages render with the CSP and no console errors", async ({
    page,
    consoleErrors,
  }) => {
    for (const { path, button } of [
      { path: "/login", button: "Entrar" },
      { path: "/signup", button: "Criar conta" },
    ]) {
      const response = await page.goto(path);
      expectStrictPolicy(response?.headers()["content-security-policy"]);
      await expect(page.getByRole("button", { name: button })).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });
});
