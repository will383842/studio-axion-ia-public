/**
 * SOUS-TITRES PAR FORMAT (lot F1). PUR. Mêmes groupes (1 à 4 mots coupés par le sens, calés sur les coupes), mêmes
 * styles ; seule leur PLACE change, d'après la bouche dans l'image du format et ses zones sûres :
 *  - 9:16 : la règle du lot C (55-72 %, juste sous la bouche), inchangée ;
 *  - 4:5 et 1:1 : juste sous la bouche, entre 55 et 80 % ; pendant un écran partagé, à la jonction ;
 *  - 16:9 : sous la bouche, entre 62 et 82 % (au-dessus de la barre de lecture) ; même taille de lettre qu'en carré
 *    (à 1 920 px de large, la lettre n'est pas agrandie de 78 %) ; pendant un écran partagé côte à côte, la ligne
 *    reste sous la bouche, centrée dans la colonne de Will et jamais plus large qu'elle.
 */
import { positionSousTitresFacecam, SOUS_TITRES_FACECAM } from "@/briques/habillage-facecam/sous-titres";
import { TAILLE_SOUS_TITRES_REFERENCE_PX } from "@/briques/composition/encadre";
import { DIMENSIONS_FACECAM, type RatioFacecam } from "./ratios";
import { dispositionEcranPartage } from "./ecran-partage";
import { zoneSure } from "./zones";

export const SOUS_TITRES_FORMATS: Record<RatioFacecam, { positionPct: readonly [number, number]; sousLaBouchePct: number; echelleTexte?: number }> = {
  "9:16": { positionPct: SOUS_TITRES_FACECAM.positionPct, sousLaBouchePct: SOUS_TITRES_FACECAM.sousLaBouchePct },
  "4:5": { positionPct: [55, 80], sousLaBouchePct: 9 },
  "1:1": { positionPct: [55, 80], sousLaBouchePct: 10 },
  "16:9": { positionPct: [62, 82], sousLaBouchePct: 12, echelleTexte: 0.9 },
};

/** Centre de la ligne (% de la hauteur) d'après la bouche la plus basse dans l'image du format (%). */
export function positionSousTitresFormat(ratio: RatioFacecam, bouchePct?: number): number {
  if (ratio === "9:16") return positionSousTitresFacecam(bouchePct);
  const r = SOUS_TITRES_FORMATS[ratio];
  const [min, maxRegle] = r.positionPct;
  // Jamais dans la zone sûre du bas : la ligne entière (≈ 1,2 lettre de haut) reste au-dessus.
  const demiLignePct = (0.6 * hauteurLettrePx(ratio) * 100) / DIMENSIONS_FACECAM[ratio].hauteur;
  const max = Math.min(maxRegle, 100 - zoneSure(ratio).bas * 100 - demiLignePct);
  if (bouchePct === undefined || !Number.isFinite(bouchePct)) return +(((min + max) / 2).toFixed(1));
  return Math.round(Math.min(max, Math.max(min, bouchePct + r.sousLaBouchePct)) * 10) / 10;
}

/** Échelle de la lettre (absente : largeur / 1 080, comme avant). */
export const echelleTexteFormat = (ratio: RatioFacecam): number | undefined => SOUS_TITRES_FORMATS[ratio].echelleTexte;

/** Hauteur de lettre de référence dans l'image du format (px). */
export function hauteurLettrePx(ratio: RatioFacecam): number {
  return TAILLE_SOUS_TITRES_REFERENCE_PX * (echelleTexteFormat(ratio) ?? 1);
}

/** Pendant un écran partagé : centre de la ligne et, côte à côte, la colonne où elle se tient. */
export function ligneEcranPartage(ratio: RatioFacecam, positionNormalePct: number): { centrePct: number; colonne?: { gauchePx: number; largeurPx: number } } {
  const d = dispositionEcranPartage(ratio);
  if (d.type === "haut") {
    const H = d.hauteurCarte + d.hauteurPersonne;
    return { centrePct: Math.round((d.hauteurCarte / H) * 1000) / 10 };
  }
  // Côte à côte : la ligne garde sa hauteur (sous la bouche), dans la colonne de Will, avec 5 % d'air de chaque côté.
  const marge = Math.round(d.largeurPersonne * 0.05);
  return { centrePct: positionNormalePct, colonne: { gauchePx: d.largeurCarte + marge, largeurPx: d.largeurPersonne - 2 * marge } };
}
