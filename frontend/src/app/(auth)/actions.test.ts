// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
const createSession = vi.fn();

vi.mock("@/lib/api/client", () => ({ getPublicApi: async () => ({ POST: post }) }));
vi.mock("@/lib/auth/session", () => ({
  createSession: (...args: unknown[]) => createSession(...args),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

import { loginAction, signupAction } from "./actions";

const credentials = { email: "maria@example.com", password: "senha-segura-1" };
const signup = { name: "Maria Silva", ...credentials, confirmPassword: "senha-segura-1" };

const ok = (data: unknown, status = 200) => ({ data, response: { status } });
const fail = (error: unknown, status: number) => ({ error, response: { status } });

beforeEach(() => {
  post.mockReset();
  createSession.mockReset();
});

describe("loginAction", () => {
  it("stores the token and redirects to the requested page", async () => {
    post.mockResolvedValue(ok({ token: "jwt" }));

    await expect(loginAction(credentials, "/tasks")).rejects.toThrow("NEXT_REDIRECT:/tasks");

    expect(post).toHaveBeenCalledWith("/api/auth/login", { body: credentials });
    expect(createSession).toHaveBeenCalledWith("jwt");
  });

  it("ignores an unsafe redirect target", async () => {
    post.mockResolvedValue(ok({ token: "jwt" }));

    await expect(loginAction(credentials, "https://evil.example")).rejects.toThrow(
      "NEXT_REDIRECT:/",
    );
  });

  it("trims the e-mail before calling the API", async () => {
    post.mockResolvedValue(ok({ token: "jwt" }));

    await expect(loginAction({ ...credentials, email: "  maria@example.com " })).rejects.toThrow();

    expect(post).toHaveBeenCalledWith("/api/auth/login", { body: credentials });
  });

  it("reports wrong credentials without creating a session", async () => {
    post.mockResolvedValue(fail({ detail: "x" }, 401));

    expect(await loginAction(credentials)).toEqual({ error: "E-mail ou senha inválidos." });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("does not call the API with invalid input", async () => {
    expect(await loginAction({ email: "", password: "" })).toHaveProperty("error");
    expect(post).not.toHaveBeenCalled();
  });

  it("shows the API's message for other errors", async () => {
    post.mockResolvedValue(fail({ detail: "Serviço indisponível." }, 503));

    expect(await loginAction(credentials)).toEqual({ error: "Serviço indisponível." });
  });

  it("handles the API being unreachable", async () => {
    post.mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await loginAction(credentials)).toEqual({
      error: "Não foi possível conectar ao servidor. Tente novamente.",
    });
  });
});

describe("signupAction", () => {
  it("creates the account, signs in and redirects home", async () => {
    post.mockResolvedValueOnce(ok({ name: "Maria Silva", email: credentials.email }, 201));
    post.mockResolvedValueOnce(ok({ token: "jwt" }));

    await expect(signupAction(signup)).rejects.toThrow("NEXT_REDIRECT:/");

    expect(post).toHaveBeenNthCalledWith(1, "/api/users", {
      body: { name: "Maria Silva", ...credentials },
    });
    expect(createSession).toHaveBeenCalledWith("jwt");
  });

  it("points at the e-mail field when it is already taken", async () => {
    post.mockResolvedValue(fail({ detail: "E-mail já cadastrado." }, 409));

    expect(await signupAction(signup)).toEqual({
      fieldErrors: { email: "Este e-mail já está cadastrado." },
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("maps model binding errors to fields", async () => {
    post.mockResolvedValue(fail({ errors: { Name: ["Nome inválido."] } }, 400));

    expect(await signupAction(signup)).toEqual({ fieldErrors: { name: "Nome inválido." } });
  });

  it("shows a general error when the API gives no field details", async () => {
    post.mockResolvedValue(fail({ detail: "Senha inválida." }, 400));

    expect(await signupAction(signup)).toEqual({ error: "Senha inválida." });
  });

  it("sends the user to the login page if the automatic sign-in fails", async () => {
    post.mockResolvedValueOnce(ok({}, 201));
    post.mockResolvedValueOnce(fail({ detail: "x" }, 401));

    await expect(signupAction(signup)).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(createSession).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords on the server too", async () => {
    expect(await signupAction({ ...signup, confirmPassword: "outra" })).toHaveProperty("error");
    expect(post).not.toHaveBeenCalled();
  });

  it("handles the API being unreachable", async () => {
    post.mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await signupAction(signup)).toEqual({
      error: "Não foi possível conectar ao servidor. Tente novamente.",
    });
  });
});
