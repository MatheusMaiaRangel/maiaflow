import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";
import { SignupForm } from "./signup-form";

const loginAction = vi.fn();
const signupAction = vi.fn();

vi.mock("@/app/(auth)/actions", () => ({
  loginAction: (...args: unknown[]) => loginAction(...args),
  signupAction: (...args: unknown[]) => signupAction(...args),
}));

beforeEach(() => {
  loginAction.mockReset();
  signupAction.mockReset();
});

describe("LoginForm", () => {
  it("shows Portuguese validation errors and does not call the server", async () => {
    render(<LoginForm />);

    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe seu e-mail.")).toBeInTheDocument();
    expect(screen.getByText("Informe sua senha.")).toBeInTheDocument();
    expect(loginAction).not.toHaveBeenCalled();
  });

  it("submits the values and the redirect target", async () => {
    loginAction.mockResolvedValue({});
    render(<LoginForm next="/tasks" />);

    await userEvent.type(screen.getByLabelText("E-mail"), "maria@example.com");
    await userEvent.type(screen.getByLabelText("Senha"), "senha-segura-1");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(loginAction).toHaveBeenCalledWith(
        { email: "maria@example.com", password: "senha-segura-1" },
        "/tasks",
      ),
    );
  });

  it("shows the error returned by the server", async () => {
    loginAction.mockResolvedValue({ error: "E-mail ou senha inválidos." });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("E-mail"), "maria@example.com");
    await userEvent.type(screen.getByLabelText("Senha"), "errada");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
  });

  it("shows the expired-session notice", () => {
    render(<LoginForm notice="Sua sessão expirou. Entre novamente." />);

    expect(screen.getByRole("status")).toHaveTextContent("Sua sessão expirou");
  });
});

describe("SignupForm", () => {
  it("requires matching passwords", async () => {
    render(<SignupForm />);

    await userEvent.type(screen.getByLabelText("Nome"), "Maria Silva");
    await userEvent.type(screen.getByLabelText("E-mail"), "maria@example.com");
    await userEvent.type(screen.getByLabelText("Senha"), "senha-segura-1");
    await userEvent.type(screen.getByLabelText("Confirmar senha"), "diferente");
    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("As senhas não conferem.")).toBeInTheDocument();
    expect(signupAction).not.toHaveBeenCalled();
  });

  it("puts a server field error under the field", async () => {
    signupAction.mockResolvedValue({ fieldErrors: { email: "Este e-mail já está cadastrado." } });
    render(<SignupForm />);

    await userEvent.type(screen.getByLabelText("Nome"), "Maria Silva");
    await userEvent.type(screen.getByLabelText("E-mail"), "maria@example.com");
    await userEvent.type(screen.getByLabelText("Senha"), "senha-segura-1");
    await userEvent.type(screen.getByLabelText("Confirmar senha"), "senha-segura-1");
    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("Este e-mail já está cadastrado.")).toBeInTheDocument();
  });
});
