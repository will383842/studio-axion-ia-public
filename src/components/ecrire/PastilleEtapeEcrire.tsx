import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * Les cinq étapes propres à Écrire (refonte R7, maquette M4) : Idée, En écriture, À filmer, À refaire, Rangée.
 * Elles reprennent les teintes des statuts de l'usine (jetons --statut-*) mais PAS un des 9 mots de statut :
 * le mot de l'étape est toujours écrit, la couleur n'est jamais seule.
 */
export type EtapeEcrire = "idee" | "ecriture" | "a-filmer" | "a-refaire" | "rangee";

const ETAPES: Record<EtapeEcrire, { libelle: string; jeton: string; pointille?: boolean; anime?: boolean }> = {
  idee: { libelle: "Idée", jeton: "brouillon" },
  ecriture: { libelle: "En écriture", jeton: "fabrication", anime: true },
  "a-filmer": { libelle: "À filmer", jeton: "valider" },
  "a-refaire": { libelle: "À refaire", jeton: "retouche", pointille: true },
  rangee: { libelle: "Rangée", jeton: "accepte" },
};

export function libelleEtapeEcrire(etape: EtapeEcrire): string {
  return ETAPES[etape].libelle;
}

export function PastilleEtapeEcrire({ etape, className }: { etape: EtapeEcrire; className?: string }) {
  const d = ETAPES[etape];
  const style: CSSProperties = { backgroundColor: `var(--statut-${d.jeton}-fond)`, color: `var(--statut-${d.jeton}-texte)` };
  if (d.pointille) {
    style.borderStyle = "dashed";
    style.borderColor = "currentColor";
  }
  return (
    <span data-etape={etape} style={style} className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-transparent px-2.5 py-px text-xs font-extrabold", className)}>
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
