/**
 * Géométrie des colonnes de texte des gabarits, en fonctions PURES (ART-1, tour 2) : ce que les gabarits posent en CSS (`largeurColonne`,
 * `Remplir.tsx`) et ce que les tests vérifient sans navigateur (`tests/visuels/bords-droits.test.ts`). Une colonne commence à `debut` au
 * facteur 1 ; ce qui est à sa gauche (icône, pastille) grandit avec le facteur de `croissance` px par unité : le début avance d'autant et la
 * largeur maximale diminue d'autant. Ce qui est à sa droite et grandit (illustration) fait reculer le bord de `recul` px par unité.
 */
import { largeurTexteMax } from "./zones";

export interface Colonne {
  /** Abscisse (px) du début du texte au facteur 1. */
  debut: number;
  /** Abscisse (px) où le texte doit s'arrêter. */
  bord: number;
  /** Largeur (px, au facteur 1) de ce qui est à gauche du texte et grandit avec le facteur. */
  croissance: number;
  /** Largeur (px, au facteur 1) de ce qui est à droite du texte et grandit avec le facteur (0 : le bord droit ne bouge pas). */
  recul: number;
}

export const colonne = (debut: number, bord: number, croissance = 0, recul = 0): Colonne => ({ debut, bord, croissance, recul });

/** Largeur maximale (px) du texte de la colonne au facteur 1 : c'est là qu'un mot insécable doit tenir (porte qualité, MOT_TROP_LONG). */
export const largeurAuFacteur1 = (c: Colonne): number => largeurTexteMax(c.debut, c.bord);

/** Bords gauche et droit (px) du texte de la colonne au facteur `f`, tels que le CSS les pose. */
export function bordsAuFacteur(c: Colonne, f: number): { gauche: number; droite: number } {
  const gauche = c.debut + c.croissance * (f - 1);
  return { gauche, droite: gauche + Math.max(0, largeurAuFacteur1(c) - (c.croissance + c.recul) * (f - 1)) };
}
