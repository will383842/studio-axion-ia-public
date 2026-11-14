/**
 * Ressemblance de RECETTE entre deux vidéos IV (doc 72 § 6.1, PUR) : somme des poids des axes identiques ÷ somme des poids
 * des axes comptés. Un axe n'est pas compté (ni au numérateur ni au dénominateur) s'il n'a qu'un code tirable ou moins, ou si
 * les deux vidéos y ont le même code neutre (ce qu'on ne remarque pas).
 */
import { AXES_VARIETE, codeDe, tirablesDe, type AxeVariete, type RecetteVarieteIV } from "@/briques/schema-motion/variete";
import { VARIANTE_PAR_VERSION } from "../sous-titres-varies";

/** Ce que l'œil remarque : poids de chaque axe. */
export const POIDS_AXES: Readonly<Record<AxeVariete, number>> = Object.freeze({
  ouverture: 3,
  recit: 2,
  camera: 2,
  apparition: 2,
  fond: 2,
  chiffres: 1.5,
  transitions: 1.5,
  rail: 1.5,
  objets: 1.5,
  texte: 1,
  fin: 1,
  matiere: 1,
  entete: 1,
  sousTitres: 1,
});

export const POIDS_TOTAL = AXES_VARIETE.reduce((t, axe) => t + POIDS_AXES[axe], 0);

/**
 * Poids EFFECTIF d'un axe (GV2-52) : l'axe des sous-titres ne pèse rien tant que le tirage de sous-titres par version est
 * éteint (`VARIANTE_PAR_VERSION` faux) : on ne compte pas ce qui ne se dessine pas. Le drapeau est un paramètre pour les tests.
 */
export function poidsAxe(axe: AxeVariete, variantesParVersion: boolean = VARIANTE_PAR_VERSION): number {
  return axe === "sousTitres" && !variantesParVersion ? 0 : POIDS_AXES[axe];
}

/** Seuil : une nouvelle vidéo reste STRICTEMENT sous ce score avec chacune des 10 dernières. */
export const SEUIL_RESSEMBLANCE = 0.5;

/** Codes sans effet visible : les partager n'est pas se ressembler. */
const NEUTRES: readonly string[] = ["CHI-A", "APP-A"];

/** De 0 (aucun axe commun) à 1 (recettes identiques). Symétrique. */
export function ressemblanceRecette(a: RecetteVarieteIV, b: RecetteVarieteIV, variantesParVersion: boolean = VARIANTE_PAR_VERSION): number {
  let commun = 0;
  let total = 0;
  for (const axe of AXES_VARIETE) {
    if (tirablesDe(axe).length <= 1) continue;
    const ca = codeDe(a, axe);
    const cb = codeDe(b, axe);
    if (ca === cb && NEUTRES.includes(ca)) continue;
    const poids = poidsAxe(axe, variantesParVersion);
    total += poids;
    if (ca === cb) commun += poids;
  }
  return total ? commun / total : 0;
}
