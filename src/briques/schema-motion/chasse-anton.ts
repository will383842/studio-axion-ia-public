/**
 * Chasse RÉELLE d'Anton Regular en capitales (avance de chaque signe, millièmes de la taille), lue dans
 * `studio-rendu/compositions/commune/polices/Anton-Regular.ttf`. PUR. Sert à mesurer un libellé court au plus près
 * (scène « Ensemble ») au lieu d'une chasse moyenne majorée, avec une marge de sécurité de 3 %.
 */

const AVANCES: ReadonlyMap<string, number> = new Map<string, number>([
  ["A", 485],
  ["B", 479],
  ["C", 474],
  ["D", 493],
  ["E", 412],
  ["F", 399],
  ["G", 485],
  ["H", 499],
  ["I", 227],
  ["J", 466],
  ["K", 472],
  ["L", 397],
  ["M", 746],
  ["N", 498],
  ["O", 486],
  ["P", 472],
  ["Q", 494],
  ["R", 477],
  ["S", 461],
  ["T", 396],
  ["U", 474],
  ["V", 469],
  ["W", 712],
  ["X", 484],
  ["Y", 446],
  ["Z", 410],
  ["À", 485],
  ["Â", 485],
  ["Ä", 485],
  ["Ç", 474],
  ["É", 412],
  ["È", 412],
  ["Ê", 412],
  ["Ë", 412],
  ["Î", 227],
  ["Ï", 227],
  ["Ô", 486],
  ["Ö", 486],
  ["Ù", 474],
  ["Û", 474],
  ["Ü", 474],
  ["Ÿ", 446],
  ["Œ", 649],
  ["Æ", 640],
  ["0", 494],
  ["1", 331],
  ["2", 494],
  ["3", 494],
  ["4", 494],
  ["5", 494],
  ["6", 494],
  ["7", 494],
  ["8", 494],
  ["9", 494],
  [" ", 234],
  ["'", 214],
  ["’", 232],
  ["-", 311],
  ["–", 311],
  ["—", 563],
  [".", 229],
  [",", 236],
  [":", 242],
  [";", 245],
  ["%", 1057],
  ["/", 405],
  ["€", 525],
  ["+", 355],
  ["&", 520],
  ["?", 492],
  ["!", 229],
  ["(", 291],
  [")", 291],
  ["·", 234],
  ["«", 578],
  ["»", 578],
  ['"', 429],
  ["#", 546],
  ["°", 389],
]);

/** Avance d'un signe absent de la table (la plus large des capitales courantes : jamais sous-estimée). */
const AVANCE_INCONNUE = 746;

/** Marge de sécurité appliquée à toute mesure. */
export const MARGE_MESURE_ANTON = 1.03;

/** Largeur (pixels) d'un texte en Anton CAPITALES à la taille `taille` (pixels), marge de sécurité comprise. */
export function largeurAnton(texte: string, taille: number): number {
  let somme = 0;
  for (const c of texte.toUpperCase()) somme += AVANCES.get(c) ?? AVANCE_INCONNUE;
  return (somme / 1000) * taille * MARGE_MESURE_ANTON;
}
