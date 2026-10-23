import Link from "next/link";
import type { ReactNode } from "react";
import { insecable } from "@/lib/textes";
import { cn } from "@/lib/cn";
import { Icone } from "./Icone";

/** En-tête de page : titre court en grotesque, une ligne d'aide au plus, actions à droite. */
export function EnTetePage({
  titre,
  sousTitre,
  retour,
  actions,
  surTitre,
  className,
}: {
  titre: ReactNode;
  sousTitre?: ReactNode;
  /** Lien « retour » (flèche) au-dessus du titre. */
  retour?: { href: string; libelle: string };
  actions?: ReactNode;
  /** Petite ligne au-dessus du titre (format, catégorie). */
  surTitre?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {retour && (
          <Link href={retour.href} className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-texte-doux hover:text-texte">
            <Icone nom="fleche-gauche" size={16} />
            {retour.libelle}
          </Link>
        )}
        {surTitre && <div className="mb-2 text-sm font-semibold text-orange-vif">{surTitre}</div>}
        <h1 className="text-[28px] text-texte sm:text-4xl">{typeof titre === "string" ? insecable(titre) : titre}</h1>
        {sousTitre && <p className="mt-2 text-[15px] text-texte-doux">{sousTitre}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Titre de section avec lien « Tout voir ». */
export function EnTeteSection({ titre, lien, compteur, className }: { titre: string; lien?: { href: string; libelle?: string }; compteur?: number; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="flex min-w-0 items-center gap-2 truncate text-lg text-texte">
        {titre}
        {compteur !== undefined && <span className="rounded-full bg-surface-2 px-2 py-0.5 font-texte text-xs font-bold tabular-nums text-texte-doux">{compteur}</span>}
      </h2>
      {lien && (
        <Link href={lien.href} className="-mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-sm font-semibold text-texte-doux hover:text-orange-vif">
          {lien.libelle ?? "Tout voir"}
          <Icone nom="chevron-droite" size={16} />
        </Link>
      )}
    </div>
  );
}
