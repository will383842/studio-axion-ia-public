/**
 * HORLOGE UNIQUE des contrôles (plan v5 B.7.1, lot G3). PUR.
 *
 * Tous les contrôles de position et toutes les durées affichées se fondent sur `dureeParleeEstimee` (syllabes du
 * `texteDit`, au débit du mode). Le modèle ne déclare JAMAIS de durée (C27). En G6, C6, C7, C10, C11 et C26 sont relancés
 * sur l'horodatage réel (`dureesReelles`).
 */
import { dureeParleeEstimee } from "@/domaine/lecture";
import type { BlocScript, SegmentScript } from "@/domaine/types";
import { phrasesDe } from "./texte";

export interface SegmentHorodate {
  index: number;
  blocRecette: string;
  segmentId: string;
  debutSec: number;
  finSec: number;
  dureeSec: number;
}

/** Durée parlée d'un texte (somme de ses phrases) au débit donné. */
export function dureeTexte(texte: string, debit: number): number {
  const phrases = phrasesDe(texte);
  return phrases.reduce((s, p) => s + dureeParleeEstimee(p, debit), 0);
}

/**
 * Horodate les segments de blocs, dans l'ordre. `texteDit` (forme parlée) prime sur `texte` (forme affichée) ;
 * `pauseApresSec` s'ajoute. `dureesReelles` (une par segment) remplace l'estimation quand l'horodatage réel existe.
 */
export function horodaterSegments(
  blocs: BlocScript[],
  debit: number,
  options: { textesDits?: Record<string, string>; dureesReelles?: number[] } = {},
): SegmentHorodate[] {
  const sortie: SegmentHorodate[] = [];
  let t = 0;
  let i = 0;
  for (const b of blocs) {
    for (const s of b.segments) {
      const dit = options.textesDits?.[s.id] ?? (s as SegmentScript & { texteDit?: string }).texteDit ?? s.texte;
      const duree = options.dureesReelles?.[i] ?? dureeTexte(dit, debit);
      const pause = Math.max(0, s.pauseApresSec ?? 0);
      sortie.push({ index: i, blocRecette: b.blocRecette, segmentId: s.id, debutSec: +t.toFixed(3), finSec: +(t + duree).toFixed(3), dureeSec: +duree.toFixed(3) });
      t += duree + pause;
      i++;
    }
  }
  return sortie;
}

/** Durée totale d'une suite de blocs. */
export function dureeBlocs(blocs: BlocScript[], debit: number): number {
  const h = horodaterSegments(blocs, debit);
  return h.length ? h[h.length - 1].finSec : 0;
}

/** Marge appliquée tant que le débit réel du double n'est pas mesuré (M0b) : 10 % (B.4.2, n° 76). */
export const MARGE_AVANT_MESURE = 0.9;
