"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/form-alert";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { apiData, ClientApiError, errorMessage, getBrowserApi } from "@/lib/api/browser";
import { problemFieldErrors } from "@/lib/api/problem";
import { profileSchema, type ProfileInput } from "@/lib/validation/profile";

const EMAIL_TAKEN = "Este e-mail já está cadastrado.";

/** Name and e-mail. The header's account menu reads them on the server, so a refresh follows a save. */
export function ProfileForm({ initial }: { initial: ProfileInput }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema), defaultValues: initial });

  const save = useMutation({
    mutationFn: async (values: ProfileInput) =>
      apiData(await getBrowserApi().PATCH("/api/users/me", { body: values })),
    onSuccess: (saved) => {
      reset({ name: saved.name, email: saved.email });
      toast.success("Dados atualizados.");
      router.refresh();
    },
    onError: (error) => {
      if (error instanceof ClientApiError && error.status === 409) {
        setError("email", { message: EMAIL_TAKEN });
        return;
      }
      const fieldErrors = error instanceof ClientApiError ? problemFieldErrors(error.problem) : {};
      if (fieldErrors.name) setError("name", { message: fieldErrors.name });
      else if (fieldErrors.email) setError("email", { message: fieldErrors.email });
      else setServerError(errorMessage(error));
    },
  });

  const onSubmit = (values: ProfileInput) => {
    setServerError(undefined);
    save.mutate(values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <FormAlert message={serverError} />
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
      <Button type="submit" className="justify-self-start" disabled={save.isPending || !isDirty}>
        {save.isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        {save.isPending ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}
