/**
 * DÉCOUPAGE DE LA VIDÉO UTILE EN PASSAGES DE 10 À 15 S, CALÉS SUR LES PAUSES DE PAROLE (lot L10). PUR.
 *
 * « Vidéo utile » : la prise après les coupes (L3), sur sa propre ligne de temps (0 → durée). Le montage coupe de
 * toute façon toutes les 2 à 4 s : en posant les frontières des passages au milieu d'une pause, les raccords entre
 * deux décors générés tombent là où personne ne parle (PLAN-IMPLEMENTATION, « Analyse »).
 *
 * Règle : depuis le début du passage, on cherche dans la fenêtre [début + min, début + max] la pause la plus longue
 * (à égalité, la plus tardive) ; sans pause, on coupe à `max` (passage marqué `coupeForcee`). Le dernier passage n'est
 * jamais plus court que `minDernierSec` quand on peut l'éviter. Chaque frontière est calée sur une image à 25 i/s.
 */
import type { MotHorodate } from "@/domaine/types";

export interface Pause {
  debutSec: number;
  finSec: number;
}

export interface PassageDecor {
  index: number;
  debutSec: number;
  finSec: number;
  dureeSec: number;
  /** Aucune pause dans la fenêtre : coupe en pleine parole (raccord plus risqué). */
  coupeForcee: boolean;
}

export interface OptionsDecoupage {
  minSec?: number;
  maxSec?: number;
  /** Le dernier passage tente de ne pas descendre sous cette durée. */
  minDernierSec?: number;
  /** Pause minimale retenue entre deux mots (s). */
  pauseMinSec?: number;
  ips?: number;
}

export const DECOUPAGE_PAR_DEFAUT: Required<OptionsDecoupage> = { minSec: 10, maxSec: 15, minDernierSec: 4, pauseMinSec: 0.2, ips: 25 };

const caler = (t: number, ips: number) => Math.round(t * ips) / ips;

/** Pauses entre mots consécutifs (≥ `pauseMinSec`), plus le silence avant le premier mot. */
export function pausesDepuisMots(mots: Pick<MotHorodate, "debutSec" | "finSec">[], pauseMinSec = DECOUPAGE_PAR_DEFAUT.pauseMinSec): Pause[] {
  const tries = [...mots].filter((m) => Number.isFinite(m.debutSec) && Number.isFinite(m.finSec)).sort((a, b) => a.debutSec - b.debutSec);
  const pauses: Pause[] = [];
  for (let i = 1; i < tries.length; i++) {
    const debut = tries[i - 1].finSec;
    const fin = tries[i].debutSec;
    if (fin - debut >= pauseMinSec) pauses.push({ debutSec: debut, finSec: fin });
  }
  return pauses;
}

export function decouperAuxPauses(dureeTotaleSec: number, pauses: Pause[], options: OptionsDecoupage = {}): PassageDecor[] {
  const o = { ...DECOUPAGE_PAR_DEFAUT, ...options };
  if (!(dureeTotaleSec > 0)) return [];
  const total = caler(dureeTotaleSec, o.ips);
  const pausesTriees = pauses.filter((p) => p.finSec > p.debutSec).sort((a, b) => a.debutSec - b.debutSec);
  const passages: PassageDecor[] = [];
  let debut = 0;
  for (let garde = 0; garde < 10_000 && total - debut > 1e-6; garde++) {
    const reste = total - debut;
    if (reste <= o.maxSec + 1e-6) {
      passages.push({ index: passages.length, debutSec: debut, finSec: total, dureeSec: caler(reste, o.ips), coupeForcee: false });
      break;
    }
    // Fenêtre de coupe ; resserrée à droite pour ne pas laisser un dernier passage trop court.
    const basse = debut + o.minSec;
    let haute = debut + o.maxSec;
    if (total - haute < o.minDernierSec && total - basse >= o.minDernierSec) haute = total - o.minDernierSec;
    let meilleure: { t: number; longueur: number } | null = null;
    for (const p of pausesTriees) {
      const milieu = (p.debutSec + p.finSec) / 2;
      if (milieu < basse || milieu > haute) continue;
      const longueur = p.finSec - p.debutSec;
      if (!meilleure || longueur >= meilleure.longueur) meilleure = { t: milieu, longueur };
    }
    const fin = caler(meilleure ? meilleure.t : haute, o.ips);
    passages.push({ index: passages.length, debutSec: debut, finSec: fin, dureeSec: caler(fin - debut, o.ips), coupeForcee: !meilleure });
    debut = fin;
  }
  return passages;
}
