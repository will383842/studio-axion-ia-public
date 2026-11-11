import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Conteneur de contenu d'une page : `largeur="pleine"` (défaut) ou `"lecture"` (mx-auto max-w-3xl, pour les écrans de texte ou de formulaire). */
export function ConteneurPage({ largeur = "pleine", className, children }: { largeur?: "pleine" | "lecture"; className?: string; children: ReactNode }) {
  return <div className={cn(largeur === "lecture" && "mx-auto max-w-3xl", className)}>{children}</div>;
}
