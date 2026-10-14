import { WavesIcon } from "lucide-react";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-2 text-xl font-semibold">
        <WavesIcon className="size-6 text-primary" aria-hidden />
        MaiaFlow
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
