import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientApiError } from "@/lib/api/browser";
import { DeleteAccount } from "./delete-account";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

const patch = vi.fn();
const refresh = vi.fn();
const deleteAccountAction = vi.fn();
const toastSuccess = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: (m: string) => toastSuccess(m), error: vi.fn() } }));
vi.mock("@/app/(app)/profile/actions", () => ({
  deleteAccountAction: () => deleteAccountAction(),
}));
vi.mock("@/lib/api/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser")>()),
  getBrowserApi: () => ({ PATCH: patch }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const ok = (data: unknown) => ({ data, response: new Response(null, { status: 200 }) });
const fail = (status: number, error: unknown) => ({
  error,
  response: new Response(null, { status }),
});

beforeEach(() => {
  patch.mockReset();
  refresh.mockReset();
  deleteAccountAction.mockReset();
  toastSuccess.mockReset();
});

describe("ProfileForm", () => {
  const initial = { name: "Maria Silva", email: "maria@example.com" };

  it("starts with the saved values and nothing to save", () => {
    render(<ProfileForm initial={initial} />, { wrapper });

    expect(screen.getByLabelText("Nome")).toHaveValue("Maria Silva");
    expect(screen.getByLabelText("E-mail")).toHaveValue("maria@example.com");
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeDisabled();
  });

  it("saves the changes, confirms and refreshes the page data", async () => {
    patch.mockResolvedValue(ok({ name: "Maria Souza", email: "maria@example.com" }));
    render(<ProfileForm initial={initial} />, { wrapper });

    const name = screen.getByLabelText("Nome");
    await userEvent.clear(name);
    await userEvent.type(name, "Maria Souza");
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(patch).toHaveBeenCalledWith("/api/users/me", {
      body: { name: "Maria Souza", email: "maria@example.com" },
    });
    expect(toastSuccess).toHaveBeenCalledWith("Dados atualizados.");
  });

  it("shows validation errors without calling the API", async () => {
    render(<ProfileForm initial={initial} />, { wrapper });

    const name = screen.getByLabelText("Nome");
    await userEvent.clear(name);
    await userEvent.type(name, "Ma");
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText("O nome deve ter pelo menos 3 caracteres.")).toBeVisible();
    expect(patch).not.toHaveBeenCalled();
  });

  it("puts a duplicated e-mail under the e-mail field", async () => {
    patch.mockResolvedValue(fail(409, { detail: "E-mail em uso." }));
    render(<ProfileForm initial={initial} />, { wrapper });

    const email = screen.getByLabelText("E-mail");
    await userEvent.clear(email);
    await userEvent.type(email, "outra@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText("Este e-mail já está cadastrado.")).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows the API's message for other failures", async () => {
    patch.mockRejectedValue(new ClientApiError(500, { detail: "Erro no servidor." }));
    render(<ProfileForm initial={initial} />, { wrapper });

    await userEvent.type(screen.getByLabelText("Nome"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Erro no servidor.");
  });
});

describe("PasswordForm", () => {
  it("rejects passwords that do not match", async () => {
    render(<PasswordForm />, { wrapper });

    await userEvent.type(screen.getByLabelText("Nova senha"), "nova-senha-1");
    await userEvent.type(screen.getByLabelText("Confirmar nova senha"), "diferente");
    await userEvent.click(screen.getByRole("button", { name: "Alterar senha" }));

    expect(await screen.findByText("As senhas não conferem.")).toBeVisible();
    expect(patch).not.toHaveBeenCalled();
  });

  it("changes the password and clears the fields", async () => {
    patch.mockResolvedValue(ok({ name: "Maria", email: "maria@example.com" }));
    render(<PasswordForm />, { wrapper });

    await userEvent.type(screen.getByLabelText("Nova senha"), "nova-senha-1");
    await userEvent.type(screen.getByLabelText("Confirmar nova senha"), "nova-senha-1");
    await userEvent.click(screen.getByRole("button", { name: "Alterar senha" }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Senha alterada."));
    expect(patch).toHaveBeenCalledWith("/api/users/me", { body: { password: "nova-senha-1" } });
    expect(screen.getByLabelText("Nova senha")).toHaveValue("");
  });

  it("shows the API's message when the change is refused", async () => {
    patch.mockRejectedValue(new ClientApiError(400, { detail: "Senha inválida." }));
    render(<PasswordForm />, { wrapper });

    await userEvent.type(screen.getByLabelText("Nova senha"), "nova-senha-1");
    await userEvent.type(screen.getByLabelText("Confirmar nova senha"), "nova-senha-1");
    await userEvent.click(screen.getByRole("button", { name: "Alterar senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Senha inválida.");
  });
});

describe("DeleteAccount", () => {
  it("asks for confirmation before deleting and lets the user back out", async () => {
    render(<DeleteAccount />);

    await userEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    expect(await screen.findByText("Excluir sua conta?")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(deleteAccountAction).not.toHaveBeenCalled();
  });

  it("deletes after the user confirms", async () => {
    deleteAccountAction.mockResolvedValue({});
    render(<DeleteAccount />);

    await userEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir conta" }));

    await waitFor(() => expect(deleteAccountAction).toHaveBeenCalledOnce());
  });

  it("shows the error when the account could not be deleted", async () => {
    deleteAccountAction.mockResolvedValue({ error: "Não foi possível excluir." });
    render(<DeleteAccount />);

    await userEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir conta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível excluir.");
  });
});
