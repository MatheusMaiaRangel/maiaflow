"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/form-alert";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { apiData, errorMessage, getBrowserApi } from "@/lib/api/browser";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validation/profile";

const EMPTY_VALUES: ChangePasswordInput = { password: "", confirmPassword: "" };

export function PasswordForm() {
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY_VALUES,
  });

  const save = useMutation({
    mutationFn: async ({ password }: ChangePasswordInput) =>
      apiData(await getBrowserApi().PATCH("/api/users/me", { body: { password } })),
    onSuccess: () => {
      reset(EMPTY_VALUES);
      toast.success("Senha alterada.");
    },
    onError: (error) => setServerError(errorMessage(error)),
  });

  const onSubmit = (values: ChangePasswordInput) => {
    setServerError(undefined);
    save.mutate(values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <FormAlert message={serverError} />
      <TextField
        label="Nova senha"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <TextField
        label="Confirmar nova senha"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button type="submit" className="justify-self-start" disabled={save.isPending}>
        {save.isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        {save.isPending ? "Salvando…" : "Alterar senha"}
      </Button>
    </form>
  );
}
