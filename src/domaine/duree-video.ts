/**
 * DURÉE AFFICHÉE D'UNE VIDÉO (constat prod 10/10) : la durée RÉELLE de la version choisie (mesurée sur la sortie
 * montée) dès qu'elle existe ; avant le montage seulement, la durée estimée du script, marquée « environ ».
 */
import { libelleDuree } from "@/formats";

export interface DureeVideo {
  sec: number;
  /** Vrai tant qu'aucune sortie montée ne donne la durée réelle (estimation du script). */
  estimee: boolean;
}

/** `sortie` : la sortie principale de la version choisie (sa `dureeSec` est mesurée sur la vidéo montée). */
export function dureeDeLaVideo(estimeeSec: number, sortie?: { dureeSec?: number } | null): DureeVideo {
  const reelle = Number(sortie?.dureeSec);
  return Number.isFinite(reelle) && reelle > 0 ? { sec: reelle, estimee: false } : { sec: estimeeSec, estimee: true };
}

/** « 1 min 23 » (réelle, arrondie à la seconde) ou « environ 1 min 53 » (estimée). */
export function libelleDureeVideo(d: DureeVideo): string {
  const l = libelleDuree(Math.max(0, Math.round(d.sec)));
  return d.estimee ? `environ ${l}` : l;
}
