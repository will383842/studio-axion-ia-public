import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import {
  FAMILLES_CONTENU,
  RESEAUX_PASTILLE,
  STATUTS_USINE,
  TEXTE_SUR_RESEAU,
  type FamilleContenu,
  type ReseauPastille,
  type StatutUsine,
} from "./statuts-usine";

const BASE = "inline-flex shrink-0 items-center whitespace-nowrap rounded-full text-xs font-extrabold";

/** Statut de l'usine (les 9 de la maquette M0). Le mot est toujours écrit ; couleurs par jetons --statut-*. */
export function PastilleStatut({ statut, className }: { statut: StatutUsine; className?: string }) {
  const d = STATUTS_USINE[statut];
  const style: CSSProperties = { backgroundColor: d.fond, color: d.texte };
  if (d.bord !== "aucun") {
    style.borderWidth = 1;
    style.borderStyle = d.bord === "pointille" ? "dashed" : "solid";
    style.borderColor = d.couleurBord;
  }
  return (
    <span data-statut={statut} style={style} className={cn(BASE, "gap-1.5 px-2.5 py-px", d.bord === "aucun" && "border border-transparent", className)}>
      {d.anime && (
        <span aria-hidden className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
      {d.libelle}
    </span>
  );
}

/** Famille de contenu : petit carré de la couleur de la famille, puis le nom (Vidéo, Carrousel, Infographie). */
export function PastilleFamille({ famille, className }: { famille: FamilleContenu; className?: string }) {
  const d = FAMILLES_CONTENU[famille];
  return (
    <span data-famille={famille} style={{ backgroundColor: d.doux, color: d.couleur }} className={cn(BASE, "gap-1.5 py-0.5 pl-2 pr-2.5", className)}>
      <span aria-hidden className="size-[9px] rounded-[3px]" style={{ backgroundColor: d.couleur }} />
      {d.libelle}
    </span>
  );
}

/** Réseau : pastille pleine de la couleur du réseau, avec son nom écrit. */
export function PastilleReseau({ reseau, className }: { reseau: ReseauPastille; className?: string }) {
  const d = RESEAUX_PASTILLE[reseau];
  return (
    <span data-reseau={reseau} style={{ backgroundColor: d.fond, color: TEXTE_SUR_RESEAU }} className={cn(BASE, "px-2.5 py-0.5", className)}>
      {d.libelle}
    </span>
  );
}
