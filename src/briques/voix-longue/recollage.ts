/**
 * RECOLLAGE DES HORODATAGES (fiche VL-02). PUR. Chaque morceau est lu par un appel séparé : ses mots sont horodatés à
 * partir de 0. On les remet bout à bout sur la durée totale : le morceau k démarre à la somme des durées des morceaux
 * avant lui (+ la pause voulue entre deux morceaux). Aucun mot perdu ni ajouté, heures croissantes.
 */
import type { MotHorodate } from "@/domaine/types";

/** Résultat de la lecture d'un morceau, tel que rendu par le port de voix. */
export interface LectureMorceau {
  dureeSec: number;
  mots: MotHorodate[];
}

export interface VoixRecollee {
  mots: MotHorodate[];
  dureeSec: number;
  /** Début de chaque morceau sur la durée totale, dans l'ordre. */
  debutsMorceauxSec: number[];
}

const arrondi = (n: number): number => Math.round(n * 1000) / 1000;

export function recollerHorodatages(lectures: LectureMorceau[], pauseEntreMorceauxSec = 0): VoixRecollee {
  if (!(pauseEntreMorceauxSec >= 0) || !Number.isFinite(pauseEntreMorceauxSec)) throw new RangeError("La pause entre morceaux doit être un nombre positif ou nul.");
  const mots: MotHorodate[] = [];
  const debuts: number[] = [];
  let decalage = 0;
  let curseur = 0;
  for (const [k, l] of lectures.entries()) {
    if (!(l.dureeSec >= 0) || !Number.isFinite(l.dureeSec)) throw new RangeError(`Durée invalide pour le morceau ${k + 1}.`);
    if (k > 0) decalage += pauseEntreMorceauxSec;
    debuts.push(arrondi(decalage));
    const dernierMot = l.mots.reduce((m, w) => Math.max(m, w.finSec), 0);
    for (const w of l.mots) {
      // Heures croissantes : un mot ne peut ni commencer avant la fin du précédent, ni finir avant son début.
      const debut = Math.max(curseur, arrondi(decalage + Math.max(0, w.debutSec)));
      const fin = Math.max(debut, arrondi(decalage + Math.max(0, w.finSec)));
      mots.push({ ...w, debutSec: debut, finSec: fin });
      curseur = fin;
    }
    decalage += Math.max(l.dureeSec, dernierMot);
  }
  return { mots, dureeSec: arrondi(decalage), debutsMorceauxSec: debuts };
}
