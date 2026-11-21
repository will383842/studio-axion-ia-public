/**
 * Pièces d'objets validées sur planche (C10-04-a, décision de Williams du 21/11 00:25 : « C10-04 fond flou sous le carton
 * magazine : OUI »). Liste FERMÉE : seule une pièce vue sur planche et acceptée y entre, jamais une pièce inconnue.
 * Fonction pure, ne lève jamais, ne lit aucun réglage. Aucun importeur (éteint par absence d'importeur).
 */
import type { IdPetitObjet } from "../motion/petits-objets/contrat";

/** Pièces acceptées sur planche. Aujourd'hui : le carton magazine (21/11/2026, Williams). */
export const PIECES_VALIDEES_SUR_PLANCHE: readonly IdPetitObjet[] = Object.freeze(["objet-carton-magazine"] as IdPetitObjet[]);

/** Pour la capacité `objet.etiquette`, ne garde que les pièces validées ; les autres capacités passent inchangées. */
export function restreindreAuxPiecesValidees(ids: readonly IdPetitObjet[] | readonly string[], capacite: string): readonly string[] {
  try {
    const liste = [...ids];
    if (capacite !== "objet.etiquette") return liste;
    return liste.filter((id) => (PIECES_VALIDEES_SUR_PLANCHE as readonly string[]).includes(id));
  } catch {
    return [];
  }
}
