/**
 * TITRE DES VIGNETTES (lot 1) — PUR. Au plus 2 lignes ; le mot clé (ou le groupe « nombre + unité ») est UN SEUL pavé.
 * Réutilise la coupe de la miniature R4 (`mettreEnPageTitre`). La mesure est injectée (navigateur : vraie police).
 */
import { estMotCle, mettreEnPageTitre, unitesCouverture } from "../miniature-mise-en-page";
import { MISES } from "./mises";
import type { MiseVignette, RatioVignette } from "./socle";

export interface UniteTitre {
  texte: string;
  pave: boolean;
}

export interface TitreVignette {
  lignes: UniteTitre[][];
  taillePx: number;
  /** Le titre ne tient pas même réduit de 15 % : à raccourcir (jamais plus petit). */
  trop: boolean;
}

/** Réduction maximale de la taille de la mise. */
export const REDUCTION_MAX = 0.15;
/** Marge horizontale du pavé (socle.css : .14em de chaque côté, plus le décalage). */
const MARGE_PAVE_EM = 0.32;

/** Groupe la première série d'unités du mot clé en une seule unité (« 2 MINUTES »). */
function unitesAvecPave(couverture: string, motCle: string | undefined): UniteTitre[] {
  const unites = unitesCouverture(couverture);
  const sortie: UniteTitre[] = [];
  let dejaPave = false;
  let i = 0;
  while (i < unites.length) {
    if (!dejaPave && estMotCle(unites[i], motCle)) {
      let j = i;
      while (j + 1 < unites.length && estMotCle(unites[j + 1], motCle)) j++;
      sortie.push({ texte: unites.slice(i, j + 1).join(" "), pave: true });
      dejaPave = true;
      i = j + 1;
    } else {
      sortie.push({ texte: unites[i], pave: false });
      i++;
    }
  }
  return sortie;
}

export interface EntreeTitre {
  couverture: string;
  motCle?: string;
  ratio: RatioVignette;
  mise: MiseVignette;
  taille?: number;
  largeur?: number;
  mesurer: (texte: string, taillePx: number) => number;
}

export function mettreTitreVignette(e: EntreeTitre): TitreVignette {
  const placement = MISES[e.ratio][e.mise].titre;
  const base = e.taille ?? placement.taille;
  const largeurMax = e.largeur ?? placement.largeur;
  const unites = unitesAvecPave(e.couverture, e.motCle);
  if (!unites.length) return { lignes: [], taillePx: base, trop: false };
  const pave = unites.find((u) => u.pave)?.texte;
  const mesurer = (texte: string, taille: number) => e.mesurer(texte, taille) + (pave && texte.includes(pave) ? MARGE_PAVE_EM * taille : 0);
  const mise = mettreEnPageTitre(unites.map((u) => u.texte), mesurer, {
    largeurMax, hauteurMax: base * 3, tailleMax: base, tailleMin: Math.ceil(base * (1 - REDUCTION_MAX)), interligne: 0.94, lignesMax: 2,
  });
  // Les lignes de `mettreEnPageTitre` sont des listes d'unités : on retrouve leur marque de pavé par position.
  let k = 0;
  const lignes = mise.lignes.map((l) => l.map(() => unites[k++]));
  const trop = mise.taillePx < base * (1 - REDUCTION_MAX);
  return { lignes, taillePx: Math.max(mise.taillePx, Math.ceil(base * (1 - REDUCTION_MAX))), trop };
}
