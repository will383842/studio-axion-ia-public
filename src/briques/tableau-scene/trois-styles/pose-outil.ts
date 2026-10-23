/**
 * OÙ EST L'OUTIL des trois styles du tableau (feutre, craie, marqueur) à un instant : PUR, lu par le rendu
 * (`PageTableau.tsx`, qui place la pointe sur l'encre réelle de chaque lettre) et par les contrôles de la fabrication
 * (`controles-tableau.ts`, qui placent la pointe sur la ligne de base de l'action). Sans alias « @/ » : importable par
 * Remotion.
 */
import { accentOutil, type Action3, type Plan3 } from "../reference/animation-3";
import { OUTIL_TABLEAU } from "./outil";
import type { StyleTableau } from "./styles";

/**
 * Ce que fait l'outil : il trace (`trace`), se déplace en l'air d'un tracé au suivant (`vol`, 0,6 s au plus), sort de
 * l'image par la droite (`sort`) ou y entre (`entre`). Il ne flotte jamais au-dessus du contenu sans écrire : au-delà de
 * 0,6 s sans tracer, il sort de l'image et revient (critique #291, B1). `accent` : sa couleur (craie terracotta,
 * capuchon orange), celle du premier tracé depuis son entrée dans l'image : elle ne change que dehors (D5).
 */
export type EtatOutil = (
  | { mode: "trace"; a: Action3; u: number }
  | { mode: "vol"; de: Action3; vers: Action3; u: number }
  | { mode: "sort"; de: Action3; u: number }
  | { mode: "entre"; vers: Action3; u: number }
) & { accent: boolean };

/** Les actions que l'outil trace lui-même (un bloc posé en fondu, la touche orange qui s'anime seule : sans lui). */
export const actionsOutil = (plan: Plan3): Action3[] => plan.actions.filter((a) => !a.fondu && !a.sansCrayon && a.duree > 0);

/** L'outil porte l'accent pour une coche, un entouré, un trait ou un texte orange (s'il entre dans l'image pour lui). */
export const outilAccent = (style: StyleTableau, a: Action3): boolean => accentOutil(style, a);

/** État de l'outil à l'instant `t` ; `null` : hors de l'image. */
export function etatOutil(plan: Plan3, t: number): EtatOutil | null {
  const O = OUTIL_TABLEAU;
  const acts = actionsOutil(plan).sort((a, b) => a.debut - b.debut);
  if (!acts.length) return null;
  const fin = (a: Action3) => a.debut + a.duree;
  /** La couleur de la traversée : celle du premier tracé fait depuis l'entrée de l'outil dans l'image. */
  const accent = (a: Action3) => {
    let i = acts.indexOf(a);
    while (i > 0 && acts[i].debut - fin(acts[i - 1]) <= O.libreMaxSec) i--;
    return !!plan.style && accentOutil(plan.style, acts[i]);
  };
  const enCours = acts.find((a) => t >= a.debut && t <= fin(a));
  if (enCours) return { mode: "trace", a: enCours, u: (t - enCours.debut) / enCours.duree, accent: accent(enCours) };
  let prec: Action3 | undefined;
  let suiv: Action3 | undefined;
  for (const a of acts) {
    if (fin(a) <= t) prec = !prec || fin(a) > fin(prec) ? a : prec;
    else if (a.debut > t && (!suiv || a.debut < suiv.debut)) suiv = a;
  }
  if (prec && suiv) {
    const ecart = suiv.debut - fin(prec);
    if (ecart <= O.libreMaxSec) return { mode: "vol", de: prec, vers: suiv, u: (t - fin(prec)) / ecart, accent: accent(prec) };
    // Il sort et revient (0,3 s chacun).
    if (t < fin(prec) + O.sortieSec) return { mode: "sort", de: prec, u: (t - fin(prec)) / O.sortieSec, accent: accent(prec) };
    if (t > suiv.debut - O.sortieSec) return { mode: "entre", vers: suiv, u: (t - (suiv.debut - O.sortieSec)) / O.sortieSec, accent: accent(suiv) };
    return null;
  }
  if (prec) return t < fin(prec) + O.sortieSec ? { mode: "sort", de: prec, u: (t - fin(prec)) / O.sortieSec, accent: accent(prec) } : null;
  return t > suiv!.debut - O.sortieSec ? { mode: "entre", vers: suiv!, u: (t - (suiv!.debut - O.sortieSec)) / O.sortieSec, accent: accent(suiv!) } : null;
}

/** Le point de sortie de l'outil (pointe hors de l'image, à droite) à la hauteur `y` : il sort à l'horizontale, loin de la bande. */
export function pointSortie(largeur: number, y: number, k: number): [number, number] {
  return [largeur + 60 * k, y];
}
