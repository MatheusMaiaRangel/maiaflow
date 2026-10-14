import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "./auth";

const validSignup = {
  name: "Maria Silva",
  email: "maria@example.com",
  password: "senha-segura-1",
  confirmPassword: "senha-segura-1",
};

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("loginSchema", () => {
  it("accepts a valid login and trims the e-mail", () => {
    const result = loginSchema.safeParse({ email: "  maria@example.com ", password: "x" });
    expect(result.success && result.data.email).toBe("maria@example.com");
  });

  it("explains what is missing, in Portuguese", () => {
    expect(messages(loginSchema.safeParse({ email: "", password: "" }))).toEqual([
      "Informe seu e-mail.",
      "Informe sua senha.",
    ]);
    expect(messages(loginSchema.safeParse({ email: "sem-arroba", password: "x" }))).toEqual([
      "Informe um e-mail válido.",
    ]);
  });
});

describe("signupSchema", () => {
  it("accepts a valid sign-up", () => {
    expect(signupSchema.safeParse(validSignup).success).toBe(true);
  });

  it.each([
    [{ name: "Ma" }, "O nome deve ter pelo menos 3 caracteres."],
    [{ password: "123", confirmPassword: "123" }, "A senha deve ter pelo menos 6 caracteres."],
    [{ confirmPassword: "outra-senha" }, "As senhas não conferem."],
    [{ email: "x" }, "Informe um e-mail válido."],
  ])("rejects %j", (override, message) => {
    expect(messages(signupSchema.safeParse({ ...validSignup, ...override }))).toContain(message);
  });

  it("rejects passwords over the 72 bytes BCrypt accepts (counting bytes, not characters)", () => {
    const longEmoji = "😀".repeat(19); // 76 bytes, 19 characters
    const result = signupSchema.safeParse({
      ...validSignup,
      password: longEmoji,
      confirmPassword: longEmoji,
    });
    expect(messages(result)).toContain("A senha é muito longa.");
  });
});
