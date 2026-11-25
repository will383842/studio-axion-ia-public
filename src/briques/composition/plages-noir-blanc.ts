/**
 * PLAGES DE NOIR ET BLANC TIRÉES DU SCRIPT (C10-05, NOIR-BLANC-a). Pur, ÉTEINT, sans importeur.
 * Pour chaque passage « de A à B » (hors argent) : plage du début du mot « avant » au début du mot « après ».
 * Règles dures : 1 à 4 s (jamais tronquée ni étirée), 2 plages au plus, 0,5 s de garde aux bords,
 * jamais sur un plan visage interdit. Non branché : aucun appelant.
 */
import { faitsDuScript } from "../faits-script/extraire";
import { familleUnite, type Fait, type MotFait } from "../faits-script/types";
import { normaliserPlagesNoirBlanc, type PlageNoirBlanc } from "../motion/habillage-commun/noir-blanc";

/** Éteint par défaut : seul `true` allume. */
export const NOIR_BLANC_ACTIF = false;
export const NB_DUREE_MIN_SEC = 1;
export const NB_DUREE_MAX_SEC = 4;
export const NB_PLAGES_MAX = 2;
export const NB_GARDE_BORDS_SEC = 0.5;
/** Marge avant le mot « après » : 0, la couleur revient au début de ce mot. */
export const NB_MARGE_RETOUR_SEC = 0;

const MOTS_ARGENT = /€|euro|prix|tarif/;
const normaliser = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const estArgent = (unite: string | undefined) => unite !== undefined && familleUnite(unite) === "argent";

function argent(fait: Fait): boolean {
  if (fait.type === "passage" && (estArgent(fait.avant.unite) || estArgent(fait.apres.unite))) return true;
  return MOTS_ARGENT.test(normaliser(fait.texte));
}

export function plagesNoirBlancDesFaits(
  mots: readonly MotFait[],
  opts: { dureeSec: number; plansInterdits?: readonly PlageNoirBlanc[]; actif?: boolean },
): PlageNoirBlanc[] {
  try {
    if (!(opts.actif ?? NOIR_BLANC_ACTIF)) return [];
    const { dureeSec } = opts;
    if (mots.length === 0 || !Number.isFinite(dureeSec) || dureeSec <= 0) return [];
    const interdits = opts.plansInterdits ?? [];
    const plages: PlageNoirBlanc[] = [];
    for (const fait of faitsDuScript(mots)) {
      if (fait.type !== "passage" || argent(fait)) continue;
      const debutMot = mots[fait.mots.premier];
      const apresMot = mots[fait.apres.surMot];
      if (!debutMot || !apresMot) continue;
      const debut = debutMot.debutMs / 1000;
      const fin = apresMot.debutMs / 1000 - NB_MARGE_RETOUR_SEC;
      const duree = Math.round((fin - debut) * 1000) / 1000;
      if (!(duree >= NB_DUREE_MIN_SEC && duree <= NB_DUREE_MAX_SEC)) continue;
      if (debut < NB_GARDE_BORDS_SEC || fin > dureeSec - NB_GARDE_BORDS_SEC) continue;
      if (interdits.some(([a, b]) => debut < b && fin > a)) continue;
      plages.push([debut, fin]);
    }
    return normaliserPlagesNoirBlanc(plages, dureeSec).slice(0, NB_PLAGES_MAX);
  } catch {
    return [];
  }
}
