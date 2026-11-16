/**
 * BIBLIOTHÈQUE D'ICÔNES (C6-H17a). PUR, SANS alias « @/ » : lisible par le rendu.
 * Données : rien ne les lit en production. Absent de tout schéma et de toute consigne (K8).
 */
import { LUCIDE_BIBLIOTHEQUE } from "./lucide";
import { PHOSPHOR_BIBLIOTHEQUE } from "./phosphor";
import { MATERIAL_BIBLIOTHEQUE } from "./material";
import { TABLER_BIBLIOTHEQUE } from "./tabler";
import { HEROICONS_BIBLIOTHEQUE } from "./heroicons";
import { ICONOIR_BIBLIOTHEQUE } from "./iconoir";
import type { IconeBibliotheque } from "./lucide";

export type { IconeBibliotheque, NoeudBibliotheque } from "./lucide";

export const ICONES_BIBLIOTHEQUE: Readonly<Record<string, IconeBibliotheque>> = Object.freeze({ ...LUCIDE_BIBLIOTHEQUE, ...PHOSPHOR_BIBLIOTHEQUE, ...MATERIAL_BIBLIOTHEQUE, ...TABLER_BIBLIOTHEQUE, ...HEROICONS_BIBLIOTHEQUE, ...ICONOIR_BIBLIOTHEQUE });

export type NomIconeBibliotheque = keyof typeof LUCIDE_BIBLIOTHEQUE | keyof typeof PHOSPHOR_BIBLIOTHEQUE | keyof typeof MATERIAL_BIBLIOTHEQUE | keyof typeof TABLER_BIBLIOTHEQUE | keyof typeof HEROICONS_BIBLIOTHEQUE | keyof typeof ICONOIR_BIBLIOTHEQUE;

/** Jeu d'origine d'un nom préfixé (« lucide:coche » → « lucide »), ou undefined si le nom est inconnu. */
export function jeuDe(nom: string): string | undefined {
  return ICONES_BIBLIOTHEQUE[nom]?.jeu;
}
