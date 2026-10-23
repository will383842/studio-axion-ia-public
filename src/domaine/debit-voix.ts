/**
 * DÉBIT DE LA VOIX (lot A4). PUR : un module de mesure et de verdict. Branché depuis le lot B2a sur le seul tableau
 * animé (`domaine/duree-tableau.ts`, recette de qualité `tableau`). Cible 165 mots/min (2,75 mots/s) pour les scripts de la chaîne courte et du tableau.
 *
 * Image→vidéo et l'avocat gardent leur PROPRE constante de débit (`domaine/image-video/complexite.ts`, recette avocat) :
 * ce module ne les concerne pas et ne doit être importé nulle part de ce côté (sessions 5f et avocat).
 */

/** Débit cible : 165 mots par minute. */
export const DEBIT_CIBLE_MOTS_PAR_SEC = 2.75;
/** Tolérance au-dessus de la cible avant l'alerte (10 %). */
export const TOLERANCE_DEBIT = 0.1;
/** Caractères par mot en français, espaces comprises (convertit un nombre de caractères en nombre de mots). */
export const CARACTERES_PAR_MOT_FR = 6.15;

/** Au-delà de ce débit (mots/s), la voix est trop rapide : cible × 1,10 ≈ 3,03. */
export const plafondMotsParSec = (): number => DEBIT_CIBLE_MOTS_PAR_SEC * (1 + TOLERANCE_DEBIT);

/** Un mot horodaté (structure minimale : la brique de déclinaison en fournit de plus riches). */
export interface MotChronometre {
  debutSec: number;
  finSec: number;
}

/** Débit réel d'un audio (mots prononcés par seconde, du premier au dernier mot) ; `null` sous 5 mots ou durée nulle. */
export function motsParSecondeMesures(mots: readonly MotChronometre[]): number | null {
  if (mots.length < 5) return null;
  const duree = mots[mots.length - 1].finSec - mots[0].debutSec;
  return duree > 0 ? +(mots.length / duree).toFixed(3) : null;
}

/** Une voix réelle mesurée. `mots`, `caracteres` et `dureeSec` : à compléter quand la mesure est relue (absents = non saisis). */
export interface MesureVoix {
  videoId: string;
  motsParSec: number;
  mots?: number;
  caracteres?: number;
  dureeSec?: number;
}

/**
 * Mesures de vraies voix, par identifiant de recette (vidéo). Les deux premières sont celles du recalibrage du 18/10/2026.
 * TODO : v-365dd2ae67ee = 1 129 caractères, 184 mots, durée « à confirmer » (ne pas deviner son débit avant).
 */
export const MESURES_VOIX: Readonly<Record<string, MesureVoix>> = Object.freeze({
  "v-dcc902c3f3dd": { videoId: "v-dcc902c3f3dd", motsParSec: 3.52 },
  "v-dd3049053f88": { videoId: "v-dd3049053f88", motsParSec: 3.27 },
});

/** Nombre de mots qu'une durée accepte : la voix ne peut pas aller plus vite que son débit, ni plus lentement que la cible compte. */
export const motsMaxPour = (dureeSec: number, debitVoix: number): number => Math.floor(dureeSec * Math.min(debitVoix, DEBIT_CIBLE_MOTS_PAR_SEC));

/** « alerte » si le débit mesuré dépasse le plafond (cible + 10 %), sinon « ok ». */
export const verdictDebit = (motsParSec: number): "ok" | "alerte" => (motsParSec > plafondMotsParSec() ? "alerte" : "ok");
