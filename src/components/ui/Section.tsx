import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Carte } from "./Carte";
import { Icone, type NomIcone } from "./Icone";

/**
 * Section de page : <section> + h2 + phrase facultative (`sousTitre`) + `action` à droite (lien discret) + contenu en Carte.
 * Props : id (ancre, sert aussi à aria-labelledby), titre, sousTitre?, action?, icone? (en gris), sansCarte? (pas de Carte), className?.
 */
export function Section({
  id,
  titre,
  sousTitre,
  action,
  icone,
  sansCarte,
  className,
  children,
}: {
  id: string;
  titre: string;
  sousTitre?: ReactNode;
  action?: ReactNode;
  icone?: NomIcone;
  sansCarte?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titre`} className={cn("scroll-mt-24", className)}>
      <div className="mb-3 flex items-center gap-3">
        {icone && (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-texte-faible">
            <Icone nom={icone} size={18} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-titre`} className="text-lg text-texte">
            {titre}
          </h2>
          {sousTitre && <p className="mt-0.5 max-w-2xl text-[15px] text-texte-doux">{sousTitre}</p>}
        </div>
        {action}
      </div>
      {sansCarte ? children : <Carte>{children}</Carte>}
    </section>
  );
}
