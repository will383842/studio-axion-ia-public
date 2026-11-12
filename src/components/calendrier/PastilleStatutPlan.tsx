import { Pastille } from "@/components/ui/Pastille";
import {
  ETATS_CALENDRIER,
  LIBELLES_ETAT as TOUS_LES_LIBELLES,
  LIBELLE_ETAT_INCONNU,
  STATUTS_VERS_ETAT,
  etatDepuisStatut,
  libelleEtat,
  statutConnu,
  type EtatCalendrier,
  type LibelleEtat,
  type TableLibelles,
  type TableStatuts,
} from "@/domaine/plan-editorial/statuts";

/**
 * La table « statut interne → libellé » est UNIQUE et vit dans le domaine (statuts.ts) : cette pastille la lit et n'en
 * garde aucune. Les noms ci-dessous sont repris tels quels pour les écrans qui les importaient d'ici.
 */
export { ETATS_CALENDRIER, LIBELLE_ETAT_INCONNU, STATUTS_VERS_ETAT, etatDepuisStatut, libelleEtat, statutConnu };
export type { EtatCalendrier, LibelleEtat, TableLibelles, TableStatuts };

/**
 * Vue des six états affichés (maquette), pour le filtre : elle est tirée de la table unique (mêmes objets, aucune valeur
 * recopiée). La table complète (Refusée, Manquée, Archivée…) reste `LIBELLES_ETAT` de statuts.ts.
 */
export const LIBELLES_ETAT: Readonly<Record<EtatCalendrier, LibelleEtat>> = Object.fromEntries(
  ETATS_CALENDRIER.map((e) => [e, TOUS_LES_LIBELLES[e]]),
) as Record<EtatCalendrier, LibelleEtat>;

/**
 * État affiché. Les six états de la maquette sont fermés, mais la table nomme aussi « Refusée », « Manquée »,
 * « Échec diffuseur » (affiché « À corriger »)… : d'où le mot libre.
 */
export type EtatAffiche = EtatCalendrier | (string & {});

export interface ProprietesPastilleStatutPlan {
  etat: EtatAffiche;
  /** Table de libellés fournie de l'extérieur ; complète la table par défaut. */
  libelles?: TableLibelles;
  className?: string;
}

/** Pastille d'état d'une entrée du calendrier : un libellé court, un ton par état. */
export function PastilleStatutPlan({ etat, libelles, className }: ProprietesPastilleStatutPlan) {
  const { libelle, ton } = libelleEtat(etat, libelles);
  return (
    <Pastille ton={ton} className={className}>
      {libelle}
    </Pastille>
  );
}
