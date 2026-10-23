/**
 * K11 · Outils communs des 12 micro-objets (lot L9b) : couleurs du trait selon le fond, courbes de temps, tracé qui
 * se dessine. PUR (aucun JSX) : les dessins (`*.tsx` de ce dossier) le lisent.
 *
 * Grille : chaque micro-objet se dessine dans un carré de 240 × 240 (la grille 24 des dessins maison, × 10), trait de
 * 9 unités, bouts et angles arrondis, contour seulement — le style de `src/briques/dessins/registre`.
 */
import type { Fond } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { c01, doux, progres, rebond, teinte, va } from "../../cas-concret/plans/commun";

export { c01, doux, progres, rebond, teinte, va };

/** Côté de la grille de dessin. */
export const GRILLE_MICRO = 240;
/** Épaisseur du trait principal (unités de grille). */
export const TRAIT_MICRO = 9;
/** Durée de l'entrée (surgir avec rebond), commune aux 12. */
export const ENTREE_MICRO_S = 0.3;

/** Ce que reçoit chaque dessin : l'instant (s) depuis son apparition, sa taille à l'écran (px), le fond. */
export type ProprietesMicroObjet = { t: number; taille: number; fond: Fond };

/** Couleurs du trait sur un fond : trait (encre ou ivoire), accent orange, vert des coches, piste grisée, papier. */
export function couleursMicro(fond: Fond) {
  const sombre = fond === "sombre";
  return {
    trait: sombre ? COULEURS_DUO.ivoire : COULEURS_DUO.encre,
    accent: sombre ? COULEURS_DUO.orangeVif : COULEURS_DUO.orange,
    vert: COULEURS_DUO.vert,
    piste: sombre ? teinte(COULEURS_DUO.ivoire, 0.22) : teinte(COULEURS_DUO.encre, 0.14),
    papier: sombre ? COULEURS_DUO.nuitHaut : COULEURS_DUO.blanc,
    blanc: COULEURS_DUO.blanc,
    encre: COULEURS_DUO.encre,
    /** Lueur orangée du fond sombre (comme la maquette) ; ombre douce sur ivoire. */
    lueur: sombre ? `drop-shadow(0 0 10px ${teinte(COULEURS_DUO.orangeVif, 0.45)})` : `drop-shadow(0 8px 14px ${teinte(COULEURS_DUO.encre, 0.12)})`,
  };
}

/** Attributs d'un tracé qui se dessine (0 → 1) : longueur normalisée par `pathLength`, pointillé décalé. */
export function seDessine(x: number) {
  const v = c01(x);
  return { pathLength: 1, strokeDasharray: "1 1", strokeDashoffset: 1 - v, opacity: v > 0 ? 1 : 0 };
}

/** Entrée commune : échelle (rebond) et opacité. */
export function entreeMicro(t: number) {
  const x = progres(t, 0, ENTREE_MICRO_S);
  return { echelle: 0.55 + 0.45 * rebond(x), opacite: c01(x * 2.5) };
}

/** Après l'animation, l'objet « respire » à peine (déplacement vertical en unités de grille, déterministe). */
export function respiration(t: number, dureeS: number): number {
  return t <= dureeS ? 0 : Math.sin(((t - dureeS) * 2 * Math.PI) / 2.8) * 2.5;
}

/** Point sur un cercle (angle en degrés, 0 = midi, sens des aiguilles). */
export function surCercle(cx: number, cy: number, r: number, angle: number): [number, number] {
  const a = ((angle - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** Interpolation linéaire. */
export const entre = (a: number, b: number, x: number) => a + (b - a) * x;

/** Contour d'un engrenage (dents trapézoïdales), centré en (cx, cy). */
export function contourEngrenage(cx: number, cy: number, rayon: number, dents: number, profondeur: number): string {
  const pas = 360 / dents;
  const points: [number, number][] = [];
  for (let i = 0; i < dents; i++) {
    const a = i * pas;
    points.push(surCercle(cx, cy, rayon - profondeur, a - pas * 0.5));
    points.push(surCercle(cx, cy, rayon - profondeur, a - pas * 0.3));
    points.push(surCercle(cx, cy, rayon, a - pas * 0.17));
    points.push(surCercle(cx, cy, rayon, a + pas * 0.17));
    points.push(surCercle(cx, cy, rayon - profondeur, a + pas * 0.3));
  }
  return `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L")}Z`;
}

/** Arc de cercle de l'angle `de` à l'angle `a` (degrés, 0 = midi), dans le sens choisi. */
export function arc(cx: number, cy: number, r: number, de: number, a: number): string {
  const [x0, y0] = surCercle(cx, cy, r, de);
  const [x1, y1] = surCercle(cx, cy, r, a);
  const ecart = a - de;
  const grand = Math.abs(ecart) > 180 ? 1 : 0;
  const sens = ecart >= 0 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${grand} ${sens} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
