"use client";

import { Loader2Icon } from "lucide-react";
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Lets the footer tell the frame that a save is running, so Esc and the overlay cannot close it then. */
const BusyContext = createContext<(busy: boolean) => void>(() => {});

type HabitDialogProps = {
  title: string;
  description: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

/** Scrollable dialog frame shared by the habit forms. Mount it only while it should be open. */
export function HabitDialog({ title, description, onClose, children }: HabitDialogProps) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => (open || busy ? undefined : onClose())}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <BusyContext value={setBusy}>{children}</BusyContext>
      </DialogContent>
    </Dialog>
  );
}

type HabitDialogFooterProps = {
  pending: boolean;
  submitLabel: string;
  pendingLabel: string;
};

export function HabitDialogFooter({ pending, submitLabel, pendingLabel }: HabitDialogFooterProps) {
  const setBusy = use(BusyContext);
  useEffect(() => {
    setBusy(pending);
    return () => setBusy(false);
  }, [pending, setBusy]);

  return (
    <DialogFooter>
      <DialogClose
        render={<Button type="button" variant="outline" className="h-11 sm:h-8" />}
        disabled={pending}
      >
        Cancelar
      </DialogClose>
      <Button type="submit" disabled={pending} className="h-11 sm:h-8">
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        {pending ? pendingLabel : submitLabel}
      </Button>
    </DialogFooter>
  );
}
