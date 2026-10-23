/**
 * OUTILS COMMUNS du lot 2 « Géométrie franche » (standard « v2 énergie », § B.4) : ressorts nommés, secousse de
 * l'ÉLÉMENT (jamais de la prise), tracé d'un trait, bruitages. N'ajoute rien à `mouvement.ts` (aucun fichier existant
 * n'est modifié) : les ressorts du standard vivent ici, à côté des éléments qui les utilisent.
 *
 * Convention : tout est piloté par `t` (secondes), converti en IMAGES à 30 i/s (`FPS_V2`) : « i0 » du standard est l'image
 * où Will dit le mot, c'est-à-dire `debut`.
 */
import { Easing, interpolate, spring } from "remotion";

export const FPS_V2 = 30;

/** Ressorts du standard (§ B.4). Dépassement et temps de pose THÉORIQUES : à confirmer avec `measureSpring`. */
export const RESSORTS = Object.freeze({
  JAILLIR: { damping: 12, stiffness: 200, mass: 0.7 },
  CLAQUER: { damping: 18, stiffness: 420, mass: 0.5 },
  POSER: { damping: 20, stiffness: 170, mass: 1 },
  GLISSER: { damping: 26, stiffness: 260, mass: 0.8 },
  TOUPIE: { damping: 9, stiffness: 140, mass: 0.8 },
  BALANCER: { damping: 5, stiffness: 90, mass: 1 },
} as const);
export type NomRessort = keyof typeof RESSORTS;

/** Image (décimale) écoulée depuis `debut` (secondes). */
export const imageDepuis = (t: number, debut: number): number => (t - debut) * FPS_V2;

/** Ressort 0 → 1 (dépasse 1 puis se pose) `i` images après son départ. Avant le départ : 0. */
export function ressort(nom: NomRessort, i: number): number {
  if (i <= 0) return 0;
  return spring({ frame: i, fps: FPS_V2, config: RESSORTS[nom] });
}

export const borne01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Progression 0 → 1 en `n` images à partir de l'image `i0`, avec une courbe d'Easing. */
export function courbe(i: number, i0: number, n: number, easing: (x: number) => number = (x) => x): number {
  return interpolate(i, [i0, i0 + n], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}

export const aspiration = Easing.in(Easing.cubic);
export const balayage = Easing.bezier(0.83, 0, 0.17, 1);
export const trace = Easing.bezier(0.33, 0, 0.2, 1);

/** Secousse amortie de l'ÉLÉMENT (jamais de la prise) : dx(k) = A · e^(−k/3) · sin(2πk/3), k images après l'impact. */
export function secousse(k: number, amplitude: number): number {
  if (k < 0 || k > 12) return 0;
  return amplitude * Math.exp(-k / 3) * Math.sin((2 * Math.PI * k) / 3);
}

/** Nombre pseudo-aléatoire fixe (0 → 1) pour un indice : même valeur à chaque rendu, aucun `Math.random`. */
export function alea(graine: number): number {
  const x = Math.sin(graine * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Bruitage : [instant (s), son de `sons/` sans extension, volume]. Aucune musique. */
export type BruitageMotion = [number, string, number];

/** Fiche d'un élément (même forme que les familles du 15/10). */
export type FicheElementV2 = Readonly<{
  id: string;
  nom: string;
  emplacement: string;
  forme: string;
  mouvement: string;
  visage: "entier" | "couvert";
  quandUtiliser: string;
  dureeMin: number;
  dureeMax: number;
}>;
