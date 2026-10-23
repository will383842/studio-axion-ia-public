/**
 * STOCK DES CAS : compteurs et filtres (lot K2). PUR : aucune lecture, aucune dépense ; les lignes viennent de
 * `construireStockCas`.
 *
 * Quatre ÉTATS, qui se recoupent (un cas est à la fois « restant » ou « traité », et « à valider » ou « validé ») :
 *   - restant : aucune vidéo qui compte (MÊME règle que l'anti-doublon, `videoCompte` : une vidéo à la corbeille compte encore) ;
 *   - traite : au moins une vidéo qui compte ;
 *   - a-valider : le script du cas n'est pas validé ;
 *   - valide : le script du cas est validé.
 * Secteur et taille viennent du rangement (cas du stock par métier) : un cas sans rangement n'est compté dans aucun des deux.
 */
import type { LigneStock } from "./cas-concret-stock";

export const ETATS_STOCK = ["restant", "traite", "a-valider", "valide"] as const;
export type EtatStock = (typeof ETATS_STOCK)[number];

export interface CompteursStock {
  total: number;
  parSecteur: Record<string, number>;
  parTaille: Record<string, number>;
  parOffre: Record<string, number>;
  parEtat: Record<EtatStock, number>;
}

/** Les états d'un cas (deux au plus : un du couple restant/traité, un du couple a-valider/valide). */
export function etatsDuCas(l: LigneStock): EtatStock[] {
  return [l.videos.comptees > 0 ? "traite" : "restant", l.script.valide ? "valide" : "a-valider"];
}

const ajouter = (m: Record<string, number>, cle: string | undefined): void => {
  if (cle) m[cle] = (m[cle] ?? 0) + 1;
};

export function syntheseStock(lignes: readonly LigneStock[]): CompteursStock {
  const s: CompteursStock = { total: lignes.length, parSecteur: {}, parTaille: {}, parOffre: {}, parEtat: { restant: 0, traite: 0, "a-valider": 0, valide: 0 } };
  for (const l of lignes) {
    ajouter(s.parSecteur, l.rangement?.secteur);
    ajouter(s.parTaille, l.rangement?.taille);
    ajouter(s.parOffre, l.offre);
    for (const e of etatsDuCas(l)) s.parEtat[e]++;
  }
  return s;
}

/** Chaque filtre est facultatif ; ceux qui sont donnés se COMBINENT (« et »). Un cas sans rangement ne passe aucun filtre de secteur ou de taille. */
export interface FiltresStock {
  secteur?: string;
  taille?: string;
  offre?: string;
  etat?: EtatStock;
}

export function filtrerStock(lignes: readonly LigneStock[], filtres: FiltresStock): LigneStock[] {
  return lignes.filter(
    (l) =>
      (!filtres.secteur || l.rangement?.secteur === filtres.secteur) &&
      (!filtres.taille || l.rangement?.taille === filtres.taille) &&
      (!filtres.offre || l.offre === filtres.offre) &&
      (!filtres.etat || etatsDuCas(l).includes(filtres.etat)),
  );
}
