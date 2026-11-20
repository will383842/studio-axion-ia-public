/**
 * MODE « SANS VOIX » DU TABLEAU ANIMÉ (fiche TA-SV, 20/11) : la même vidéo, SANS voix : mêmes scènes, mêmes dessins, mêmes
 * sous-titres et textes à l'écran. Silence total, aucune musique. Aucun appel HeyGen, aucune ligne de coût « voix », coût 0 €.
 * Le mode AVEC voix reste le défaut et la règle L1-05 (seule la voix HeyGen maître parle) reste entière pour lui.
 *
 * Rythme : chaque scène reste à l'écran le temps de LIRE son texte, avec l'estimation de durée existante
 * (`dureeDiteSec`, `domaine/duree-tableau.ts`), jamais moins d'un plancher de lecture. La durée cible reste une
 * remarque, jamais un refus. PUR : aucun service, aucun fournisseur, aucune voix.
 */
import { caracteresDits, dureeDiteSec } from "@/domaine/duree-tableau";

/** Libellé du choix dans l'écran du générateur. */
export const LIBELLE_SANS_VOIX = "Sans voix (sous-titres et texte à l'écran)";

/** Détail affiché sous le choix. */
export const DETAIL_SANS_VOIX = "Même vidéo, silence total, sans musique : rien n'est dépensé en voix (0 €).";

/**
 * Le moteur de fabrication (`fabriquer.ts`, fichier réservé à will-dc le 20/11) sait-il sauter l'étape « voix » et
 * poser des scènes au rythme de lecture ? Tant que c'est faux, une fabrication « sans voix » est refusée AVANT toute
 * dépense, avec une phrase claire. À passer à `true` avec le changement du moteur (voir la description de la PR).
 */
export const MOTEUR_SANS_VOIX_PRET = false;

export const RAISON_SANS_VOIX_MOTEUR_ABSENT = "Le mode « sans voix » est choisi mais le moteur de fabrication ne le gère pas encore : rien n'a été dépensé. Choisissez « Avec voix » ou attendez la mise à jour.";

/** Plancher de lecture d'une scène (secondes) : même un texte très court reste le temps d'être vu. */
export const LECTURE_MIN_SCENE_SEC = 2.5;

/** Marge de confort ajoutée à la lecture d'une scène (secondes) : sans voix, on lit plus lentement qu'on ne dit. */
export const MARGE_LECTURE_SEC = 0.8;

/** Une scène posée au rythme de lecture (secondes depuis le début de la vidéo). */
export interface SceneSansVoix {
  id: string;
  debutSec: number;
  finSec: number;
}

/** Durée d'une scène sans voix : le temps de lire son texte (estimation existante), avec plancher et marge. */
export function dureeSceneSansVoixSec(texteDit: string): number {
  if (!caracteresDits(texteDit)) return LECTURE_MIN_SCENE_SEC;
  return Math.max(LECTURE_MIN_SCENE_SEC, Math.round((dureeDiteSec(texteDit) + MARGE_LECTURE_SEC) * 10) / 10);
}

/** Scènes posées bout à bout, au rythme de lecture. */
export function planSansVoix(scenes: readonly { id: string; texteDit: string }[]): { scenes: SceneSansVoix[]; dureeSec: number } {
  let t = 0;
  const posees = scenes.map((s) => {
    const debutSec = Math.round(t * 10) / 10;
    t += dureeSceneSansVoixSec(s.texteDit);
    return { id: s.id, debutSec, finSec: Math.round(t * 10) / 10 };
  });
  return { scenes: posees, dureeSec: Math.round(t * 10) / 10 };
}

/** Coût de la voix en mode sans voix : toujours 0 (aucun appel HeyGen, aucune ligne de coût « voix »). */
export const COUT_VOIX_SANS_VOIX_CENTIMES = 0;

/** Remarque (jamais un refus) quand la durée au rythme de lecture dépasse la durée cible. */
export function remarqueDuree(dureeSec: number, dureeCibleSec: number | undefined): string | null {
  if (!dureeCibleSec || dureeSec <= dureeCibleSec) return null;
  return `Sans voix, la lecture prend ${Math.round(dureeSec)} s (cible : ${Math.round(dureeCibleSec)} s). La vidéo reste fabricable.`;
}
