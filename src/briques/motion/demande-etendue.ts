/**
 * DEMANDE DE RENDU DES MODÈLES 7 À 13 (brique `motion`, lot F2) : même contrat que `demande.ts` — l'opération
 * `composition` EXISTANTE de `studio-rendu`, sans mode, `parametres.composition` = l'identifiant de la composition,
 * `parametres.proprietes` = la carte et sa mise en page. Aucun nouveau contrat, aucune nouvelle file. PUR, sans « @/ ».
 */
import { CATALOGUE_MOTION_ETENDU, estModeleEtendu } from "./catalogue-etendu";
import { parametresCarteModele, parametresCarteSurMesure, type ParametresRenduCarte } from "./demande";
import { verifierSurMesure, type CodeSurMesure } from "./sur-mesure";
import type { CarteModele, MiseEnPageCarte, ProprietesCarteMotion } from "./types";
import type { CarteModeleEtendu, CarteMotionTous } from "./types-etendus";

/** Paramètres de l'opération `composition` (sans mode) pour une carte des modèles 7 à 13. */
export function parametresCarteModeleEtendu(carte: CarteModeleEtendu, mp: MiseEnPageCarte): ParametresRenduCarte {
  return { composition: CATALOGUE_MOTION_ETENDU[carte.modele].composition, proprietes: { ...mp, ...carte } as unknown as ProprietesCarteMotion };
}

/** Paramètres de rendu pour l'une des 13 cartes (les 6 premières par `parametresCarteModele`, inchangé). */
export function parametresCarteTous(carte: CarteMotionTous, mp: MiseEnPageCarte): ParametresRenduCarte {
  return estModeleEtendu(carte.modele) ? parametresCarteModeleEtendu(carte as CarteModeleEtendu, mp) : parametresCarteModele(carte as CarteModele, mp);
}

/**
 * `preparerCarte` pour les 13 modèles (mission L, monteur face caméra) : même règle — le code sur mesure s'il passe les
 * garde-fous, sinon le repli (ou la carte) ; une carte du catalogue sinon. Les 6 premiers modèles donnent exactement
 * les paramètres de `preparerCarte`.
 */
export function preparerCarteTous(
  entree: { carte?: CarteMotionTous; code?: CodeSurMesure; repli?: CarteMotionTous },
  mp: MiseEnPageCarte,
): { parametres: ParametresRenduCarte | null; repli: boolean; erreurs: string[] } {
  if (entree.code) {
    const verdict = verifierSurMesure(entree.code, mp.images / mp.fps, mp.hauteurVideo);
    if (verdict.ok) return { parametres: parametresCarteSurMesure(entree.code, mp), repli: false, erreurs: [] };
    const repli = entree.repli ?? entree.carte;
    return { parametres: repli ? parametresCarteTous(repli, mp) : null, repli: true, erreurs: verdict.erreurs };
  }
  if (entree.carte) return { parametres: parametresCarteTous(entree.carte, mp), repli: false, erreurs: [] };
  return { parametres: null, repli: false, erreurs: ["aucune carte"] };
}
