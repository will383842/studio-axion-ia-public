import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Micro-animation d'entrée (fondu + léger glissement, 250 ms) en CSS pur :
 * visible même sans JavaScript, coupée par prefers-reduced-motion. `index` décale les éléments d'une liste.
 */
export function Apparition({ children, index = 0, className }: { children: ReactNode; index?: number; className?: string }) {
  return (
    <div className={cn("animate-[apparition_.25s_cubic-bezier(.22,1,.36,1)_both]", className)} style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      {children}
    </div>
  );
}
