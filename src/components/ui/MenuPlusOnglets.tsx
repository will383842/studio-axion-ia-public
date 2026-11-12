"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone } from "./Icone";

/**
 * Menu « Plus » des onglets : `<details>` natif (les liens restent dans le HTML serveur).
 * Se referme au clic sur un lien, au clic en dehors et sur Échap.
 */
export function MenuPlusOnglets({ actif, children, className }: { actif: boolean; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fermer = () => el.removeAttribute("open");
    const clicDehors = (e: MouseEvent) => {
      if (el.open && !el.contains(e.target as Node)) fermer();
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) {
        fermer();
        el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("click", clicDehors);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("click", clicDehors);
      document.removeEventListener("keydown", touche);
    };
  }, []);

  return (
    <details ref={ref} className={cn("group/plus relative shrink-0", className)} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) ref.current?.removeAttribute("open"); }}>
      <summary
        className={cn(
          "flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors [&::-webkit-details-marker]:hidden",
          actif ? "bg-texte text-fond" : "text-texte-doux hover:text-texte",
        )}
      >
        Plus
        <Icone nom="chevron-bas" size={16} />
      </summary>
      <div className="fixed inset-x-4 z-20 mt-1 flex lg:absolute lg:inset-x-auto lg:right-0 lg:top-full lg:min-w-48 flex-col gap-1 rounded-carte border border-trait bg-surface-1 p-2 shadow-carte">
        {children}
      </div>
    </details>
  );
}
