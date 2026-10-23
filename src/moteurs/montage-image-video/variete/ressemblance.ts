/**
 * Ressemblance de RECETTE entre deux vidéos IV (doc 72 § 6.1, PUR) : somme des poids des axes identiques ÷ 15,5.
 * Ex. : seulement la caméra et la matière en commun → (2 + 1) ÷ 15,5 = 19 % ; tout sauf la fin et les sous-titres → 90 %.
 */
import { AXES_VARIETE, type AxeVariete, type RecetteVarieteIV } from "@/briques/schema-motion/variete";

/** Ce que l'œil remarque : poids de chaque axe. */
export const POIDS_AXES: Readonly<Record<AxeVariete, number>> = Object.freeze({
  ouverture: 3,
  recit: 2,
  camera: 2,
  apparition: 2,
  chiffres: 1.5,
  transitions: 1.5,
  texte: 1,
  fin: 1,
  matiere: 1,
  sousTitres: 0.5,
});

export const POIDS_TOTAL = 15.5;

/** Seuil : une nouvelle vidéo reste STRICTEMENT sous ce score avec chacune des 10 dernières. */
export const SEUIL_RESSEMBLANCE = 0.6;

/** De 0 (aucun axe commun) à 1 (recettes identiques). Symétrique. */
export function ressemblanceRecette(a: RecetteVarieteIV, b: RecetteVarieteIV): number {
  let commun = 0;
  for (const axe of AXES_VARIETE) if (a[axe] === b[axe]) commun += POIDS_AXES[axe];
  return commun / POIDS_TOTAL;
}
