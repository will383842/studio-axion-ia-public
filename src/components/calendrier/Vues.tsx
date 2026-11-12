"use client";

import { useSyncExternalStore } from "react";
import { Icone } from "@/components/ui/Icone";
import { regrouper, replier, type RegroupementPar } from "@/domaine/calendrier/regroupement";
import type { IdReseau } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { libelleJour } from "./BarreVue";
import { CarteEntreeCalendrier, MonogrammeReseau, TYPES_CONTENU, estVerrouillee, styleReseau, type EntreeCarte } from "./CarteEntreeCalendrier";
import type { TableLibelles } from "./PastilleStatutPlan";
import { DENSITES_SEMAINE, type DensiteSemaine } from "./GrilleSemaine";

export interface ProprietesVueListe {
  entrees: readonly EntreeCarte[];
  /** Jour de Paris d'aujourd'hui (AAAA-MM-JJ), pour les cadenas. */
  aujourdhui: string;
  /** Regroupement : par réseau, par type ou par jour. */
  par: RegroupementPar;
  /** Cartes montrées par groupe avant « + N autres » (entier de 1 au moins) ; absent : tout est montré. */
  maxParGroupe?: number;
  /** Vrai si un filtre est actif : change le message de liste vide. */
  filtresActifs?: boolean;
  libellesEtat?: TableLibelles;
  tropProches?: ReadonlySet<string>;
  lienEntree?: (entree: EntreeCarte) => string | null | undefined;
  onOuvrirEntree?: (entree: EntreeCarte) => void;
  className?: string;
}

function EnTeteGroupe({ par, cle, libelle, nombre }: { par: RegroupementPar; cle: string; libelle: string; nombre: number }) {
  return (
    <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-extrabold text-texte">
      {par === "reseau" && <MonogrammeReseau reseau={cle as IdReseau} />}
      {par === "type" && TYPES_CONTENU[cle as keyof typeof TYPES_CONTENU] && <Icone nom={TYPES_CONTENU[cle as keyof typeof TYPES_CONTENU].icone} size={14} />}
      {par === "jour" ? libelleJour(cle) || cle : libelle}
      <span className="font-semibold text-texte-doux">({nombre})</span>
    </h3>
  );
}

/**
 * Vue « liste » : les publications regroupées par réseau, type ou jour. Chaque carte garde son liseré de réseau
 * et dit son type par icône et libellé. Un groupe chargé se replie sous « + N autres » (les cartes restent dans la page).
 */
export function VueListe({ entrees, aujourdhui, par, maxParGroupe, filtresActifs, libellesEtat, tropProches, lienEntree, onOuvrirEntree, className }: ProprietesVueListe) {
  const groupes = regrouper(entrees, par);
  if (groupes.length === 0) {
    return <div className={cn("mt-2 rounded-xl border border-dashed border-trait-fort bg-surface-1 p-5 text-center text-sm text-texte-doux", className)}>{filtresActifs ? "Aucune publication avec ces filtres." : "Rien de prévu sur cette période."}</div>;
  }
  const carte = (e: EntreeCarte) => (
    <CarteEntreeCalendrier key={e.cle} entree={e} avecTitre libellesEtat={libellesEtat} verrouillee={estVerrouillee(e, aujourdhui)} tropProche={tropProches?.has(e.cle)} href={lienEntree?.(e)} onOuvrir={onOuvrirEntree} />
  );
  return (
    <div className={cn("grid gap-4", className)}>
      {groupes.map((g) => {
        const { visibles, reste } = replier(g.entrees, maxParGroupe);
        const cachees = g.entrees.slice(visibles.length);
        return (
          <section key={g.cle} data-groupe={g.cle} style={par === "reseau" ? styleReseau(g.cle as IdReseau) : undefined}>
            <EnTeteGroupe par={par} cle={g.cle} libelle={g.libelle} nombre={g.entrees.length} />
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">{visibles.map(carte)}</div>
            {reste > 0 && (
              <details className="mt-1.5">
                <summary className="inline-flex min-h-[44px] cursor-pointer items-center rounded-[9px] border border-dashed border-trait-fort bg-surface-1 px-3 text-sm font-bold text-texte-doux hover:border-orange hover:text-orange-vif sm:min-h-[38px]">
                  + {reste} autre{reste > 1 ? "s" : ""}
                </summary>
                <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">{cachees.map(carte)}</div>
              </details>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** CAL-09 : clé de mémoire (navigateur) du choix de densité de la vue Semaine. */
export const CLE_DENSITE_SEMAINE = "axion.calendrier.densite-semaine";
const DENSITE_DEFAUT: DensiteSemaine = "visuel";
const ECOUTEURS = new Set<() => void>();

/** Densité retenue ; Visuel si rien n'est retenu, si la valeur est illisible ou si la mémoire du navigateur est fermée. */
export function lireDensiteSemaine(): DensiteSemaine {
  try {
    const v = window.localStorage.getItem(CLE_DENSITE_SEMAINE);
    return v === "compact" || v === "visuel" ? v : DENSITE_DEFAUT;
  } catch {
    return DENSITE_DEFAUT;
  }
}

export function retenirDensiteSemaine(d: DensiteSemaine): void {
  try {
    window.localStorage.setItem(CLE_DENSITE_SEMAINE, d);
  } catch {
    // Mémoire fermée : le choix vaut pour la page seulement.
  }
  ECOUTEURS.forEach((f) => f());
}

function abonner(f: () => void): () => void {
  ECOUTEURS.add(f);
  window.addEventListener("storage", f);
  return () => {
    ECOUTEURS.delete(f);
    window.removeEventListener("storage", f);
  };
}

/** Densité de la vue Semaine, retenue d'une visite à l'autre (à utiliser dans un composant client). */
export function useDensiteSemaine(): [DensiteSemaine, (d: DensiteSemaine) => void] {
  const densite = useSyncExternalStore(abonner, lireDensiteSemaine, () => DENSITE_DEFAUT);
  return [densite, retenirDensiteSemaine];
}

/** Choix Compact / Visuel de la vue Semaine ; le choix est retenu. `onChange` prévient l'appelant. */
export function SelecteurDensiteSemaine({ onChange, className }: { onChange?: (d: DensiteSemaine) => void; className?: string }) {
  const [densite, choisir] = useDensiteSemaine();
  return (
    <div role="group" aria-label="Densité de la semaine" className={cn("inline-flex gap-1", className)}>
      {(Object.keys(DENSITES_SEMAINE) as DensiteSemaine[]).map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={d === densite}
          onClick={() => {
            choisir(d);
            onChange?.(d);
          }}
          className={cn("min-h-[44px] rounded-[9px] border px-3 text-sm font-bold", d === densite ? "border-orange bg-orange-doux text-texte" : "border-trait-fort bg-surface-1 text-texte-doux hover:border-orange")}
        >
          {DENSITES_SEMAINE[d].libelle}
        </button>
      ))}
    </div>
  );
}
