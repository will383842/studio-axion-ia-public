/**
 * Réglages de mouvement des composants « Image → vidéo » et couleur d'un trait. PUR, sans alias « @/ » : lus par
 * `studio-rendu` (`plan.ts`, ré-exportés) et par le plan des objets (`plan-objets.ts`), donc par le contrôle de mise
 * en page du moteur.
 */
import { COULEURS_DUO } from "../habillage/charte-duo";
import { AVANCE_NOEUD_IV, type CouleurSchema } from "./types";

/** Réglages de mouvement (secondes). */
export const TEMPS_IV = Object.freeze({
  /** Le nœud surgit un peu avant son mot, pour être posé quand il est dit (seule source : `AVANCE_NOEUD_IV`, lue aussi par L11). */
  avanceNoeud: AVANCE_NOEUD_IV,
  surgir: 0.45,
  /** La flèche se dessine juste avant que son nœud d'arrivée surgisse. */
  dessinFleche: 0.5,
  /** Part du tracé à partir de laquelle la pointe se pose (elle arrive en dernier). */
  pointe: 0.82,
  coche: 0.35,
  /** Après la séparation : départ et durée du compteur des parts. */
  compteurDepart: 0.3,
  compteurDuree: 1.2,
  fondu: 0.25,
});

/** Couleur d'un trait ou d'une pastille d'après la couleur du schéma. */
export function couleurTrait(c: CouleurSchema): string {
  return c === "orange" ? COULEURS_DUO.orangeVif : c === "vert" ? COULEURS_DUO.vert : c === "neutre" ? COULEURS_DUO.grisClair : COULEURS_DUO.encre;
}
