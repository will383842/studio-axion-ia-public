import Link from "next/link";
import type { CriteresFiltre } from "@/domaine/calendrier/regroupement";
import type { IdReseau } from "@/domaine/types";
import { BarreFiltres, RESEAUX_CALENDRIER } from "./BarreFiltres";
import { FiltresCalendrier } from "./FiltresCalendrier";
import { BarreVue, type LiensBarreVue, type VueCalendrier } from "./BarreVue";

/** Libellés fixes de la maquette (CAL-26). */
export const LIBELLES_CALENDRIER = { aFaire: "À faire", aPlacer: "À placer", mesTextes: "Mes textes", retirer: "Retirer du calendrier", aCorriger: "À corriger" } as const;

export interface ProprietesEnTeteCalendrier {
  vue: VueCalendrier;
  periode: string;
  liens: LiensBarreVue;
  reseauxActifs: readonly IdReseau[];
  /** Adresse qui allume ou éteint un réseau. */
  lienReseau: (reseau: IdReseau) => string;
  /** Adresse qui rallume les quatre réseaux. */
  lienTout: string;
  /** Adresse de « + Ajouter ». */
  lienAjouter: string;
  /** Filtres de l'adresse (types, états, mot cherché) et adresse de la vue sans eux : « Filtrer » ouvre alors les vraies cases. Absent : l'ancien panneau (réseaux seulement). */
  filtres?: { criteres: CriteresFiltre; base: string };
}

const BOUTON = "inline-flex min-h-[38px] items-center justify-center rounded-[10px] border border-trait-fort bg-surface-1 px-3 text-sm font-bold text-texte hover:bg-surface-2";

/**
 * Haut de l'écran au repos : six commandes seulement — la période avec ses flèches, Aujourd'hui, Semaine ou Mois,
 * Filtrer, + Ajouter, et les pastilles des réseaux. Un seul bouton principal : « + Ajouter ».
 */
export function EnTeteCalendrier({ vue, periode, liens, reseauxActifs, lienReseau, lienTout, lienAjouter, filtres }: ProprietesEnTeteCalendrier) {
  const tousAllumes = reseauxActifs.length === RESEAUX_CALENDRIER.length;
  const panneauLiens = (
    <div className="mt-2">
      <Link href="/ecrire/voix" className="mb-2 flex min-h-11 items-center font-bold underline underline-offset-4">
        {LIBELLES_CALENDRIER.mesTextes}
      </Link>
      {tousAllumes ? <span className="text-texte-faible">Tous les réseaux sont affichés.</span> : <Link href={lienTout} className="font-bold underline underline-offset-4">Afficher tous les réseaux</Link>}
    </div>
  );
  return (
    <div>
      <BarreVue vue={vue} periode={periode} liens={liens}>
        {filtres ? (
          <FiltresCalendrier criteres={filtres.criteres} base={filtres.base}>
            {panneauLiens}
          </FiltresCalendrier>
        ) : (
          <details className="relative">
            <summary className={`${BOUTON} cursor-pointer`}>Filtrer</summary>
            <div className="absolute z-30 mt-1 w-[240px] max-w-[90vw] rounded-xl border border-trait-fort bg-surface-2 p-3 text-sm text-texte shadow-carte">
              <p className="mb-2 text-texte-doux">Allumez ou éteignez un réseau avec les pastilles ci-dessous.</p>
              {panneauLiens}
            </div>
          </details>
        )}
        <Link href={lienAjouter} className="inline-flex min-h-[38px] items-center justify-center rounded-[10px] bg-accent px-3 text-sm font-bold text-sur-accent">
          + Ajouter
        </Link>
      </BarreVue>
      <BarreFiltres actifs={reseauxActifs} lienReseau={lienReseau} />
    </div>
  );
}
