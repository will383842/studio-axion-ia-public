/**
 * Courbes de mouvement du style « interface claire ». Une seule famille : entrée rapide avec léger rebond
 * (mesuré sur la référence : l'élément dépasse sa taille ou sa position d'environ 5-10 % puis se pose).
 */
import { Easing, interpolate } from "remotion";

const BORNE = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Progression 0 → 1 entre `debut` et `debut + duree` (secondes), sans rebond. */
export function progression(t: number, debut: number, duree: number): number {
  return interpolate(t, [debut, debut + duree], [0, 1], BORNE);
}

/** Progression avec léger dépassement (« back out ») : dépasse 1 puis revient. */
export function rebond(t: number, debut: number, duree: number, force = 1.4): number {
  return interpolate(t, [debut, debut + duree], [0, 1], { ...BORNE, easing: Easing.out(Easing.back(force)) });
}

/** Sortie douce 0 → 1. */
export function sortie(t: number, debut: number, duree: number): number {
  return interpolate(t, [debut, debut + duree], [0, 1], { ...BORNE, easing: Easing.in(Easing.cubic) });
}

/** Vrai si `t` est dans [debut, fin[. */
export const dans = (t: number, debut: number, fin: number) => t >= debut && t < fin;
