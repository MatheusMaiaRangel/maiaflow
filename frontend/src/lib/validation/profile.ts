import { z } from "zod";
import { emailSchema, nameSchema, newPasswordSchema } from "./auth";

export const profileSchema = z.object({
  name: nameSchema,
  email: emailSchema,
});

export const changePasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem.",
  });

export type ProfileInput = z.infer<typeof profileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
