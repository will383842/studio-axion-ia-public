import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Rangée horizontale à défilement aimanté (brouillons, dernières vidéos). Déborde jusqu'aux bords sur mobile. */
export function Carrousel({ children, largeurElement = "w-[42%] sm:w-48", className, libelle }: { children: ReactNode[]; largeurElement?: string; className?: string; libelle: string }) {
  return (
    <ul aria-label={libelle} className={cn("sans-barre -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 lg:mx-0 lg:px-0", className)}>
      {children.map((c, i) => (
        <li key={i} className={cn("shrink-0 snap-start", largeurElement)}>
          {c}
        </li>
      ))}
    </ul>
  );
}
