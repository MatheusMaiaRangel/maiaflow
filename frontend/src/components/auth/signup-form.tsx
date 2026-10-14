"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { signupAction } from "@/app/(auth)/actions";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";

export function SignupForm() {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = (values: SignupInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await signupAction(values);
      if (result?.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          if (field in values) setError(field as keyof SignupInput, { message });
        }
      }
      if (result?.error) setServerError(result.error);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {serverError ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      ) : null}
      <TextField
        label="Nome"
        autoComplete="name"
        error={errors.name?.message}
        {...register("name")}
      />
      <TextField
        label="E-mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        label="Senha"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <TextField
        label="Confirmar senha"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        {pending ? "Criando conta…" : "Criar conta"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
