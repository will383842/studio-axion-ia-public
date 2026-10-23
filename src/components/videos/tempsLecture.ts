"use client";

/**
 * TEMPS DE LECTURE PARTAGÉ de la fiche vidéo (lot M3, B.9 « Sous-titres sous la vidéo ») : le lecteur publie son temps
 * courant ; la liste des sous-titres le lit (groupe en cours surligné) et peut déplacer la lecture.
 * Un seul lecteur par page : un petit magasin au niveau du module suffit.
 */
import { useSyncExternalStore } from "react";

let temps = 0;
let aller: ((t: number) => void) | null = null;
const ecouteurs = new Set<() => void>();

export function publierTemps(t: number): void {
  if (Math.abs(t - temps) < 0.02) return;
  temps = t;
  for (const e of ecouteurs) e();
}

export function enregistrerAller(f: (t: number) => void): void {
  aller = f;
}

/** Déplace la lecture (sans effet si aucun lecteur n'est affiché). */
export function allerAuTemps(t: number): void {
  aller?.(t);
  publierTemps(t);
}

function abonner(e: () => void) {
  ecouteurs.add(e);
  return () => ecouteurs.delete(e);
}

export function useTempsLecture(): number {
  return useSyncExternalStore(
    abonner,
    () => temps,
    () => 0,
  );
}

/** Groupe affiché à l'instant `t` (PUR, testé) : celui qui contient t, sinon aucun (pendant un blanc). */
export function groupeA<T extends { debutSec: number; finSec: number }>(groupes: T[], t: number): number {
  return groupes.findIndex((g) => t >= g.debutSec && t < g.finSec + 0.05);
}
