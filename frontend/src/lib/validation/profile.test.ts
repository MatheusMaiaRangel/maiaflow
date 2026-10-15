import { describe, expect, it } from "vitest";
import { changePasswordSchema, profileSchema } from "./profile";

describe("profileSchema", () => {
  it("trims the name and the e-mail", () => {
    const result = profileSchema.parse({ name: "  Maria Silva ", email: " maria@example.com " });

    expect(result).toEqual({ name: "Maria Silva", email: "maria@example.com" });
  });

  it("rejects a short name and an invalid e-mail with Portuguese messages", () => {
    const result = profileSchema.safeParse({ name: "Ma", email: "nope" });

    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((issue) => issue.message);
    expect(messages).toContain("O nome deve ter pelo menos 3 caracteres.");
    expect(messages).toContain("Informe um e-mail válido.");
  });
});

describe("changePasswordSchema", () => {
  it("accepts matching passwords", () => {
    expect(
      changePasswordSchema.safeParse({ password: "nova-senha-1", confirmPassword: "nova-senha-1" })
        .success,
    ).toBe(true);
  });

  it("rejects passwords that do not match", () => {
    const result = changePasswordSchema.safeParse({
      password: "nova-senha-1",
      confirmPassword: "outra",
    });

    expect(result.error?.issues[0]).toMatchObject({
      path: ["confirmPassword"],
      message: "As senhas não conferem.",
    });
  });

  it("rejects a password shorter than 6 characters and one longer than 72 bytes", () => {
    expect(
      changePasswordSchema.safeParse({ password: "12345", confirmPassword: "12345" }).success,
    ).toBe(false);
    const long = "a".repeat(73);
    expect(changePasswordSchema.safeParse({ password: long, confirmPassword: long }).success).toBe(
      false,
    );
  });
});
