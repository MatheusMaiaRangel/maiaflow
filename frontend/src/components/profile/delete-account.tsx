"use client";

import { useState, useTransition } from "react";
import { deleteAccountAction } from "@/app/(app)/profile/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(undefined);
    startTransition(async () => {
      // On success the action redirects to the login page and never returns.
      const result = await deleteAccountAction();
      setError(result.error);
      setOpen(false);
    });
  };

  return (
    <div className="grid justify-items-start gap-3">
      <FormAlert message={error} />
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Excluir minha conta
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Excluir sua conta?"
        description="Sua conta, todas as suas tarefas e todos os seus hábitos (com o histórico) serão apagados para sempre. Esta ação não pode ser desfeita."
        confirmLabel="Excluir conta"
        pendingLabel="Excluindo…"
        pending={pending}
        onConfirm={confirm}
      />
    </div>
  );
}
