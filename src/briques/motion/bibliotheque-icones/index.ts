/**
 * BIBLIOTHÈQUE D'ICÔNES (C6-H17a). PUR, SANS alias « @/ » : lisible par le rendu.
 * Données : rien ne les lit en production. Absent de tout schéma et de toute consigne (K8).
 */
import { LUCIDE_BIBLIOTHEQUE } from "./lucide";
import type { IconeBibliotheque } from "./lucide";

export type { IconeBibliotheque, NoeudBibliotheque } from "./lucide";

export const ICONES_BIBLIOTHEQUE: Readonly<Record<string, IconeBibliotheque>> = Object.freeze({ ...LUCIDE_BIBLIOTHEQUE });

export type NomIconeBibliotheque = keyof typeof LUCIDE_BIBLIOTHEQUE;

/** Jeu d'origine d'un nom préfixé (« lucide:coche » → « lucide »), ou undefined si le nom est inconnu. */
export function jeuDe(nom: string): string | undefined {
  return ICONES_BIBLIOTHEQUE[nom]?.jeu;
}
