/**
 * MESURE DE L'ÉCRITURE AU STYLO : largeur réelle d'un texte dans les polices que le rendu DESSINE pour le tableau animé
 * (habillage `charte-video/1`) — Montserrat ExtraBold pour les titres, Inter Bold pour le texte et les légendes —
 * d'après la chasse lue dans les fichiers de police (`metriques-ecriture.ts`, généré). Le rendu écrit sans crénage ni ligatures : la chasse fait la largeur,
 * au pixel près. L'approche (`letter-spacing`) s'ajoute après CHAQUE caractère, espaces compris, comme en CSS.
 * PUR, sans alias « @/ » : importable par Remotion.
 */
import { CARACTERES_ECRITURE, INTER_BOLD, INTER_MEDIUM, MONTSERRAT_EXTRABOLD } from "./metriques-ecriture";

/**
 * Police d'écriture : « titre » (Montserrat ExtraBold), « texte » (Inter Bold) ou « detail » (Inter Medium : détails et
 * mentions du style « reference/3 », charte Axion du 15/10/2026).
 */
export type PoliceEcriture = "titre" | "texte" | "detail";

const TABLES: Record<PoliceEcriture, { unitesParEm: number; largeurs: readonly number[] }> = { titre: MONTSERRAT_EXTRABOLD, texte: INTER_BOLD, detail: INTER_MEDIUM };

const INDEX = new Map<string, number>();
Array.from(CARACTERES_ECRITURE).forEach((c, i) => {
  if (!INDEX.has(c)) INDEX.set(c, i);
});

function chasse(police: PoliceEcriture, c: string): number {
  const t = TABLES[police];
  const i = INDEX.get(c) ?? INDEX.get(c.normalize("NFD")[0]) ?? INDEX.get("n")!;
  return t.largeurs[i] / t.unitesParEm;
}

/** Largeur (px) d'un texte (espaces compris) à la taille donnée, approche comprise. */
export function largeurEcrite(texte: string, police: PoliceEcriture, taillePx: number, approcheEm = 0): number {
  let em = 0;
  let n = 0;
  for (const c of texte) {
    em += chasse(police, c);
    n++;
  }
  return (em + n * approcheEm) * taillePx;
}

/** Position (px depuis le début de la ligne) et largeur de chaque mot d'une ligne écrite d'un seul tenant. */
export function motsEcrits(ligne: string, police: PoliceEcriture, taillePx: number, approcheEm = 0): { texte: string; x: number; largeur: number }[] {
  const res: { texte: string; x: number; largeur: number }[] = [];
  const re = /\S+/g;
  for (let m = re.exec(ligne); m; m = re.exec(ligne)) {
    res.push({ texte: m[0], x: largeurEcrite(ligne.slice(0, m.index), police, taillePx, approcheEm), largeur: largeurEcrite(m[0], police, taillePx, approcheEm) });
  }
  return res;
}

/** Style CSS qui rend la mesure exacte : ni crénage, ni ligatures, ni variantes contextuelles. */
export const STYLE_ECRITURE_EXACTE = Object.freeze({
  fontKerning: "none",
  fontVariantLigatures: "none",
  fontFeatureSettings: '"kern" 0, "liga" 0, "clig" 0, "calt" 0',
} as const);
