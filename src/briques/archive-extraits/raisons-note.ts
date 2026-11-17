/**
 * Raisons de la note en clair (X4-12c). Table de phrases pure : code de `noter` (ou du tri) -> phrase lisible.
 * Williams ne lit jamais un identifiant interne. Aucun appelant tant que X4-12b n'est pas posée ; tout éteint.
 */
export const PHRASE_RAISON_NOTE: Readonly<Record<string, string>> = Object.freeze({
  interface: "montre un écran d'outil",
  chiffre: "montre un chiffre",
  demarche: "montre une démarche",
  geste: "montre un geste dans l'outil",
  texte: "texte seul à l'écran",
  visage: "visage qui parle, rien d'autre",
  inconnu: "contenu non reconnu",
  "source-propre": "image propre, sans visage ni texte",
  "texte-incruste": "sous-titres incrustés dans l'image",
  "sujet-reconnu": "sujet reconnu",
  "sujet-absent": "aucun sujet reconnu",
  fait: "contient un fait précis",
  "mot-cle": "contient le mot-clé de la vidéo",
  "phrase-creuse": "phrase d'ouverture ou de fin",
  duree: "bonne durée (3 à 6 s)",
  "exclu-droit": "interdit par les règles de droit",
  chevauchement: "doublon d'un meilleur passage",
  plafond: "trop d'extraits pour cette vidéo",
  "peu-d-interet": "pas assez utile",
});

const AUTRE_RAISON = "autre raison";

/** La phrase du code, ou « autre raison » (jamais le code lui-même). */
export function raisonEnClair(code: string): string {
  return Object.prototype.hasOwnProperty.call(PHRASE_RAISON_NOTE, code) ? PHRASE_RAISON_NOTE[code] : AUTRE_RAISON;
}

/** Raisons triées par |points| décroissant puis code ; `sens` plus si points > 0, moins sinon. */
export function raisonsEnClair(
  raisons: readonly { code: string; points: number }[],
): { phrase: string; sens: "plus" | "moins" }[] {
  return [...raisons]
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
    .map((r) => ({ phrase: raisonEnClair(r.code), sens: r.points > 0 ? ("plus" as const) : ("moins" as const) }));
}

/** « 3 passages ignorés, surtout : … » ; null si rien d'ignoré. */
export function pourquoiIgnores(ignores?: { nombre: number; raisonPrincipale: string | null }): string | null {
  if (!ignores || ignores.nombre === 0) return null;
  const base = ignores.nombre === 1 ? "1 passage ignoré" : `${ignores.nombre} passages ignorés`;
  return ignores.raisonPrincipale ? `${base}, surtout : ${raisonEnClair(ignores.raisonPrincipale)}` : base;
}
