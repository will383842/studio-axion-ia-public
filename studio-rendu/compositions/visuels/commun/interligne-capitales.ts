/**
 * Interligne des titres en capitales (ART-1) : fonctions PURES. L'encre d'Inter Display Black (fichier `../../commune/polices/InterDisplay-Black.ttf`)
 * déborde de la hauteur des capitales : accents en haut (É, À : 0,948 em), jambages en bas (Ç : 0,201 em, virgule : 0,165 em). Un interligne fixe
 * serré faisait toucher la cédille de « Ç » et l'accent de « É » de la ligne du dessous (« IDÉE REÇUE, / RÉALITÉ », production du 23/10) ;
 * l'interligne d'un titre se calcule donc sur SES lignes : serré quand rien ne dépasse, ouvert juste ce qu'il faut sinon.
 * Valeurs relevées dans la police (unités / 2048, arrondies au millième) : `HAUT_ENCRE` (au-dessus de 0,75 em), `BAS_ENCRE` (sous 0,02 em).
 */

/** Interligne minimal d'un titre en capitales (les capitales seules : 0,75 em d'encre). */
export const INTERLIGNE_MIN = 0.98;
/** Écart d'encre minimal (em) entre le bas d'une ligne et le haut de la suivante. */
export const ECART_ENCRE = 0.05;
/** Hauteur des capitales (dépassements optiques compris) et de leur base. */
const HAUT_CAPITALE = 0.75;
const BAS_CAPITALE = 0.012;
/** Métriques verticales de la police (hhea) : la ligne de base est posée à `interligne / 2 + (ASCENDANTE − DESCENDANTE) / 2` du haut de la boîte de ligne. */
export const ASCENDANTE = 1984 / 2048;
export const DESCENDANTE = 494 / 2048;

/** Haut de l'encre (em au-dessus de la ligne de base) des signes qui dépassent les capitales. */
const HAUT_ENCRE: Readonly<Record<string, number>> = { "$": 0.834, "(": 0.765, ")": 0.765, "/": 0.762, "[": 0.765, "\\": 0.762, "]": 0.765, "{": 0.765, "|": 0.962, "}": 0.765, "\u00b2": 0.835, "\u00b3": 0.835, "\u00b9": 0.828, "\u00c0": 0.948, "\u00c1": 0.948, "\u00c2": 0.948, "\u00c3": 0.946, "\u00c4": 0.949, "\u00c5": 1.002, "\u00c8": 0.948, "\u00c9": 0.948, "\u00ca": 0.948, "\u00cb": 0.949, "\u00cc": 0.948, "\u00cd": 0.948, "\u00ce": 0.948, "\u00cf": 0.949, "\u00d1": 0.946, "\u00d2": 0.948, "\u00d3": 0.948, "\u00d4": 0.948, "\u00d5": 0.946, "\u00d6": 0.949, "\u00d8": 0.771, "\u00d9": 0.948, "\u00da": 0.948, "\u00db": 0.948, "\u00dc": 0.949, "\u00dd": 0.948, "\u00e5": 0.791, "\u00f0": 0.764, "\u0178": 0.949 };
/** Bas de l'encre (em sous la ligne de base) des signes qui descendent. */
const BAS_ENCRE: Readonly<Record<string, number>> = { "$": 0.106, "(": 0.144, ")": 0.144, ",": 0.165, "/": 0.109, ";": 0.165, "@": 0.223, "Q": 0.054, "[": 0.144, "\\": 0.109, "]": 0.144, "_": 0.14, "g": 0.211, "j": 0.204, "p": 0.204, "q": 0.204, "y": 0.204, "{": 0.144, "|": 0.234, "}": 0.144, "\u00a1": 0.204, "\u00a6": 0.137, "\u00a7": 0.146, "\u00b5": 0.204, "\u00b8": 0.204, "\u00bf": 0.222, "\u00c7": 0.201, "\u00d8": 0.043, "\u00e7": 0.204, "\u00f8": 0.025, "\u00fd": 0.204, "\u00fe": 0.204, "\u00ff": 0.204, "\u201a": 0.165, "\u201e": 0.165, "\u2192": 0.066 };

/** Haut de l'encre d'une ligne (em au-dessus de la ligne de base). */
export function hautEncre(ligne: string): number {
  return Math.max(HAUT_CAPITALE, ...[...ligne].map((c) => HAUT_ENCRE[c] ?? 0));
}

/** Bas de l'encre d'une ligne (em sous la ligne de base). */
export function basEncre(ligne: string): number {
  return Math.max(BAS_CAPITALE, ...[...ligne].map((c) => BAS_ENCRE[c] ?? 0));
}

/** Écarts d'encre (em) entre chaque ligne et la suivante, à l'interligne donné : négatif = les lettres se touchent. */
export function ecartsEncre(lignes: readonly string[], interligne: number): number[] {
  return lignes.slice(1).map((l, i) => interligne - basEncre(lignes[i]) - hautEncre(l));
}

/** Interligne d'un titre : le plus petit (au moins `INTERLIGNE_MIN`) qui laisse `ECART_ENCRE` entre chaque paire de lignes voisines. */
export function interligneCapitales(lignes: readonly string[]): number {
  const besoin = Math.max(0, ...lignes.slice(1).map((l, i) => basEncre(lignes[i]) + hautEncre(l) + ECART_ENCRE));
  return Math.max(INTERLIGNE_MIN, Math.ceil(besoin * 100) / 100);
}

/**
 * Place (em) que le bloc de titre réserve au-dessus de la première boîte de ligne et sous la dernière : l'encre qui dépasse (accents en haut,
 * jambages en bas) et, en bas, la zone de contenu de la police (`ASCENDANTE + DESCENDANTE` = 1,21 em, plus haute qu'une ligne serrée) que
 * Chromium compte dans la hauteur défilable : sans elle, une zone qui coupe ce qui dépasse croirait le titre coupé.
 */
export function depassementsEncre(lignes: readonly string[], interligne: number): { haut: number; bas: number } {
  if (lignes.length === 0) return { haut: 0, bas: 0 };
  const base = interligne / 2 + (ASCENDANTE - DESCENDANTE) / 2;
  const zoneContenu = (ASCENDANTE + DESCENDANTE - interligne) / 2;
  return { haut: Math.max(0, hautEncre(lignes[0]) - base), bas: Math.max(0, base + basEncre(lignes[lignes.length - 1]) - interligne, zoneContenu) };
}
