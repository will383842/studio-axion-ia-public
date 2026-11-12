import Link from "next/link";
import type { ReactNode } from "react";
import type { IdReseau } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { MonogrammeReseau, nomReseau, styleReseau } from "./CarteEntreeCalendrier";

/** Les réseaux du calendrier, dans l'ordre de la maquette. */
export const RESEAUX_CALENDRIER: readonly IdReseau[] = ["linkedin", "instagram", "facebook", "tiktok"];

/** Allume ou éteint un réseau ; le résultat suit l'ordre de `ordre`. Ne modifie pas la liste reçue. */
export function basculerReseau(actifs: readonly IdReseau[], reseau: IdReseau, ordre: readonly IdReseau[] = RESEAUX_CALENDRIER): IdReseau[] {
  const suite = actifs.includes(reseau) ? actifs.filter((r) => r !== reseau) : [...actifs, reseau];
  const rang = (r: IdReseau) => (ordre.includes(r) ? ordre.indexOf(r) : ordre.length);
  return [...suite].sort((a, b) => rang(a) - rang(b));
}

/** Ne garde que les entrées des réseaux allumés. */
export function filtrerParReseau<T extends { reseau: IdReseau }>(entrees: readonly T[], actifs: readonly IdReseau[]): T[] {
  return entrees.filter((e) => actifs.includes(e.reseau));
}

export interface ProprietesBarreFiltres {
  /** Réseaux proposés (défaut : les quatre de la maquette). */
  reseaux?: readonly IdReseau[];
  /** Réseaux allumés. */
  actifs: readonly IdReseau[];
  /** Rendu client : un clic sur une pastille. */
  onBasculer?: (reseau: IdReseau) => void;
  /** Rendu serveur : l'adresse qui allume ou éteint ce réseau. */
  lienReseau?: (reseau: IdReseau) => string;
  /** Nombre d'AUTRES filtres actifs (type, état…) : au-dessus de zéro, « Effacer les filtres (N) » apparaît. */
  nombreFiltres?: number;
  onEffacer?: () => void;
  lienEffacer?: string;
  /** Emplacement pour des filtres supplémentaires, après les pastilles. */
  children?: ReactNode;
  className?: string;
}

const BOUTON_EFFACER = "inline-flex min-h-[38px] items-center rounded-[10px] border border-trait-fort bg-surface-1 px-3 text-sm font-bold text-texte hover:bg-surface-2";

/**
 * Filtre simple par réseau : une pastille par réseau (picto et nom), qu'on allume ou éteint.
 * Les pastilles servent aussi de légende des couleurs de réseau (`--c`, voir `styleReseau`).
 */
export function BarreFiltres({ reseaux = RESEAUX_CALENDRIER, actifs, onBasculer, lienReseau, nombreFiltres = 0, onEffacer, lienEffacer, children, className }: ProprietesBarreFiltres) {
  const libelleEffacer = `Effacer les filtres (${nombreFiltres})`;
  return (
    <div role="group" aria-label="Réseaux affichés" className={cn("my-2 flex flex-wrap items-center gap-1.5", className)}>
      {reseaux.map((reseau) => {
        const actif = actifs.includes(reseau);
        const nom = nomReseau(reseau);
        const classes = cn(
          "inline-flex min-h-[34px] items-center gap-1.5 rounded-full border-[1.5px] border-[color:var(--c)] py-1 pl-[5px] pr-[11px] text-sm font-bold",
          // Éteinte : pointillé, fond et texte plus doux ; jamais d'opacité (la pastille est un bouton actif, le texte garde 4,5:1).
          actif ? "bg-surface-1 text-texte" : "border-dashed bg-surface-2 text-texte-doux",
        );
        const contenu = (
          <>
            <MonogrammeReseau reseau={reseau} />
            {nom}
          </>
        );
        if (lienReseau) {
          return (
            <Link key={reseau} href={lienReseau(reseau)} aria-label={`${nom}, ${actif ? "affiché" : "masqué"}`} data-reseau={reseau} style={styleReseau(reseau)} className={classes}>
              {contenu}
            </Link>
          );
        }
        return (
          <button key={reseau} type="button" aria-label={nom} aria-pressed={actif} data-reseau={reseau} style={styleReseau(reseau)} className={classes} onClick={onBasculer ? () => onBasculer(reseau) : undefined}>
            {contenu}
          </button>
        );
      })}
      {children}
      {nombreFiltres > 0 &&
        (lienEffacer ? (
          <Link href={lienEffacer} aria-label={libelleEffacer} className={BOUTON_EFFACER}>
            {libelleEffacer}
          </Link>
        ) : onEffacer ? (
          <button type="button" aria-label={libelleEffacer} onClick={onEffacer} className={BOUTON_EFFACER}>
            {libelleEffacer}
          </button>
        ) : null)}
    </div>
  );
}
