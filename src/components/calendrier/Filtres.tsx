import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { basculer, nombreFiltres, type CriteresFiltre } from "@/domaine/calendrier/regroupement";
import { TYPES_CONTENU, type TypeContenu } from "./CarteEntreeCalendrier";
import { ETATS_CALENDRIER, libelleEtat, type TableLibelles } from "./PastilleStatutPlan";

/** Les quatre types de la maquette, dans son ordre. */
export const TYPES_FILTRE: readonly { cle: TypeContenu; libelle: string }[] = (Object.keys(TYPES_CONTENU) as TypeContenu[]).map((cle) => ({ cle, libelle: TYPES_CONTENU[cle].libelle }));

export interface ProprietesFiltres {
  criteres: CriteresFiltre;
  /** Reçoit les nouveaux critères à chaque case cochée ou décochée, et à « Effacer ». */
  onChanger: (criteres: CriteresFiltre) => void;
  /** États en plus des six par défaut (table CAL-10) : leurs clés s'ajoutent au groupe État. */
  libellesEtat?: TableLibelles;
  className?: string;
  /** Liens ou textes ajoutés en bas du panneau (ex. « Mes textes »), pour garder une seule commande « Filtrer » en haut d'écran. */
  enPlus?: ReactNode;
  /** Vrai : « Effacer les filtres (N) » se range dans le panneau au lieu de s'ajouter à la barre (au plus six commandes). */
  effacerDansLePanneau?: boolean;
}

/** Les filtres (hors réseaux) sous forme de suite d'adresse « &types=…&etats=…&q=… » ; chaîne vide s'il n'y en a aucun. */
export function suiteFiltres(criteres: Pick<CriteresFiltre, "types" | "etats" | "motCle">): string {
  const mot = (criteres.motCle ?? "").trim();
  return `${criteres.types.length ? `&types=${criteres.types.join(",")}` : ""}${criteres.etats.length ? `&etats=${criteres.etats.join(",")}` : ""}${mot ? `&q=${encodeURIComponent(mot)}` : ""}`;
}

const CASE = "inline-flex min-h-[44px] items-center gap-1.5 rounded-[9px] border border-trait-fort px-2.5 text-sm font-semibold text-texte sm:min-h-[38px]";
const BOUTON = "inline-flex min-h-[44px] cursor-pointer items-center rounded-[10px] border border-trait-fort bg-surface-1 px-3 text-sm font-bold text-texte hover:bg-surface-2 sm:min-h-[38px]";

/**
 * Bouton « Filtrer » qui ouvre deux groupes de cases, Type et État, combinables, plus un mot cherché.
 * Dès qu'un filtre est actif, « Effacer les filtres (N) » apparaît et remet tout à zéro (les réseaux ne bougent pas).
 */
export function Filtres({ criteres, onChanger, libellesEtat, className, enPlus, effacerDansLePanneau = false }: ProprietesFiltres) {
  const etats = [...ETATS_CALENDRIER, ...Object.keys(libellesEtat ?? {}).filter((cle) => !(ETATS_CALENDRIER as readonly string[]).includes(cle))];
  const nombre = nombreFiltres(criteres);
  const libelleEffacer = `Effacer les filtres (${nombre})`;
  const effacer = () => onChanger({ ...criteres, types: [], etats: [], motCle: "" });
  const boutonEffacer = (
    <button type="button" aria-label={libelleEffacer} onClick={effacer} className={BOUTON}>
      {libelleEffacer}
    </button>
  );
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <details className="relative">
        <summary className={BOUTON}>Filtrer</summary>
        <div className="absolute z-30 mt-1 w-[260px] max-w-[90vw] rounded-xl border border-trait-fort bg-surface-2 p-3 shadow-carte">
          <fieldset className="m-0 border-0 p-0">
            <legend className="font-bold text-texte">Type</legend>
            <div className="mb-2.5 mt-1.5 flex flex-wrap gap-1.5">
              {TYPES_FILTRE.map((t) => (
                <label key={t.cle} className={CASE}>
                  <input type="checkbox" data-ft={t.cle} checked={criteres.types.includes(t.cle)} onChange={() => onChanger({ ...criteres, types: basculer(criteres.types, t.cle) })} />
                  {t.libelle}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="m-0 border-0 p-0">
            <legend className="font-bold text-texte">État</legend>
            <div className="mb-2.5 mt-1.5 flex flex-wrap gap-1.5">
              {etats.map((etat) => (
                <label key={etat} className={CASE}>
                  <input type="checkbox" data-fe={etat} checked={criteres.etats.includes(etat)} onChange={() => onChanger({ ...criteres, etats: basculer(criteres.etats, etat) })} />
                  {libelleEtat(etat, libellesEtat).libelle}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-bold text-texte">
            Mot cherché
            <input type="search" value={criteres.motCle ?? ""} onChange={(ev) => onChanger({ ...criteres, motCle: ev.target.value })} className="mt-1 block min-h-[44px] w-full rounded-[9px] border border-trait-fort bg-surface-1 px-2 font-normal text-texte sm:min-h-[38px]" />
          </label>
          {nombre > 0 && effacerDansLePanneau && <div className="mt-2">{boutonEffacer}</div>}
          {enPlus}
        </div>
      </details>
      {nombre > 0 && !effacerDansLePanneau && boutonEffacer}
    </span>
  );
}
