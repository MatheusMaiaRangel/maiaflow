"use client";

import { MenuIcon, WavesIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavLinks } from "./nav-links";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu" />
        }
      >
        <MenuIcon aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 gap-6 p-4">
        <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
          <WavesIcon className="size-5 text-primary" aria-hidden />
          MaiaFlow
        </SheetTitle>
        <NavLinks onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
