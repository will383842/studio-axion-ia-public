import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface ProprietesCarte extends HTMLAttributes<HTMLElement> {
  /** Survol et curseur (carte cliquable). */
  interactive?: boolean;
  /** Lueur orange en haut de la carte. */
  lueur?: boolean;
  /** Supprime le rembourrage (vignette pleine largeur). */
  sansMarge?: boolean;
  as?: "div" | "section" | "article" | "li";
}

/** Carte : surface, rayon 16 px, trait fin, ombre douce. */
export function Carte({ interactive, lueur, sansMarge, as: Balise = "div", className, children, ...props }: ProprietesCarte) {
  return (
    <Balise
      className={cn(
        "relative isolate overflow-hidden rounded-carte border border-trait bg-surface-1 shadow-carte",
        !sansMarge && "p-4 sm:p-5",
        interactive &&
          "cursor-pointer transition-[border-color,transform,background-color] duration-200 ease-studio hover:-translate-y-0.5 hover:border-trait-fort hover:bg-surface-2",
        className,
      )}
      {...props}
    >
      {lueur && <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 lueur" />}
      {children}
    </Balise>
  );
}
