/**
 * Reprises d'affilée entre un texte et des textes antérieurs (PUR). Ne refait pas la mesure : il réutilise les primitives de
 * `ecriture-commune/ressemblance.ts` (phrases, fenêtres, mots pleins, normalisation) avec une taille de fenêtre au choix.
 * (La proximité de SUJET entre publications reste dans `proximite/score.ts`.)
 */
import { fenetres, phrases, PLEINS_MIN, sequencesDe } from "@/domaine/ecriture-commune/ressemblance";

export interface Reprise {
  /** Mots repris tels qu'écrits dans le texte. */
  texte: string;
  mots: number;
}

/** Suites de `taille` mots ou plus (au moins `PLEINS_MIN` mots pleins) du texte déjà dites dans un des `anterieurs`. */
export function reprisesDAffilee(texte: string, anterieurs: readonly string[], taille = 6): Reprise[] {
  const dites = new Set(anterieurs.flatMap((a) => sequencesDe(a, taille)));
  if (!dites.size) return [];
  const res: Reprise[] = [];
  for (const p of phrases(texte)) {
    const couvert = new Array<boolean>(p.length).fill(false);
    for (const f of fenetres(p, taille)) if (f.pleins >= PLEINS_MIN && dites.has(f.cle)) for (let k = f.debut; k < f.fin; k++) couvert[k] = true;
    let debut = -1;
    for (let k = 0; k <= p.length; k++) {
      if (couvert[k] && debut < 0) debut = k;
      if (!couvert[k] && debut >= 0) {
        res.push({ texte: p.slice(debut, k).map((x) => x.brut).join(" "), mots: k - debut });
        debut = -1;
      }
    }
  }
  return res.sort((a, b) => b.mots - a.mots);
}
