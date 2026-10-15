import { z } from "zod";

const MAX_PASSWORD_BYTES = 72; // BCrypt ignores everything after 72 bytes; the API rejects longer passwords.

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail.")
  .max(256, "O e-mail deve ter no máximo 256 caracteres.")
  .pipe(z.email("Informe um e-mail válido."));

export const nameSchema = z
  .string()
  .trim()
  .min(3, "O nome deve ter pelo menos 3 caracteres.")
  .max(100, "O nome deve ter no máximo 100 caracteres.");

export const newPasswordSchema = z
  .string()
  .min(6, "A senha deve ter pelo menos 6 caracteres.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES,
    "A senha é muito longa.",
  );

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha."),
});

export const signupSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, "Confirme sua senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem.",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
