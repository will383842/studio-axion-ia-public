/**
 * Recollage des élisions coupées par la transcription (« l » + « 'IA » → « l'IA », « d » + « 'abord » → « d'abord »).
 * Brique PURE, SANS AUCUN import : le rendu Remotion peut l'importer par chemin relatif.
 * Règles (identiques à `recollerElisions` de la face caméra animée) : une apostrophe de tête (' ou ’) est recollée au mot
 * précédent, sauf si celui-ci finit par une ponctuation finale ; dans ce cas, ou sans mot précédent, l'apostrophe est retirée.
 */

/** Un mot de sortie : il couvre les mots d'entrée `de` à `a` (inclus) et s'écrit `texte`. */
export interface MotRecolle {
  de: number;
  a: number;
  texte: string;
}

const APOSTROPHE_DE_TETE = /^['’]/;
const PONCTUATION_FINALE = /([.,;:!?…])[\s»"”)]*$/;

/** Plan de recollage d'une liste de textes (un texte = un mot transcrit). */
export function planRecollage(textes: readonly string[]): MotRecolle[] {
  const sortie: MotRecolle[] = [];
  textes.forEach((t, i) => {
    if (!APOSTROPHE_DE_TETE.test(t)) {
      sortie.push({ de: i, a: i, texte: t });
      return;
    }
    const prec = sortie[sortie.length - 1];
    if (prec && !PONCTUATION_FINALE.test(prec.texte)) sortie[sortie.length - 1] = { de: prec.de, a: i, texte: prec.texte + t };
    else sortie.push({ de: i, a: i, texte: t.replace(/^['’]+/, "") });
  });
  return sortie;
}

/** Mots transcrits `{ w, a, f }` (début, fin) : garde les autres champs ; `fort` vaut vrai si l'un des deux l'était. */
export function recollerElisionsTranscrites<T extends { w: string; a: number; f: number }>(mots: readonly T[]): T[] {
  return planRecollage(mots.map((m) => m.w)).map((p) => {
    if (p.de === p.a) return { ...mots[p.de], w: p.texte };
    const premier = mots[p.de] as T & { fort?: boolean };
    const dernier = mots[p.a] as T & { fort?: boolean };
    return { ...premier, w: p.texte, f: dernier.f, ...(premier.fort || dernier.fort ? { fort: true } : {}) };
  });
}

/** Mots horodatés `{ mot, debutSec, finSec }` : début du premier, fin du dernier, autres champs du premier (`enValeur` si l'un des deux). */
export function recollerElisionsHorodatees<T extends { mot: string; debutSec: number; finSec: number }>(mots: readonly T[]): T[] {
  return planRecollage(mots.map((m) => m.mot)).map((p) => {
    if (p.de === p.a) return { ...mots[p.de], mot: p.texte };
    const premier = mots[p.de] as T & { enValeur?: boolean };
    const dernier = mots[p.a] as T & { enValeur?: boolean };
    return { ...premier, mot: p.texte, finSec: dernier.finSec, ...(premier.enValeur || dernier.enValeur ? { enValeur: true } : {}) };
  });
}
