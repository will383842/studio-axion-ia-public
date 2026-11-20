/**
 * K2-T2-b1 : non branché ; K2-T2-b2 l'appellera derrière la porte `texte.selectif`. Affichage seul : minutage et `.srt` intouchés.
 * Règle pure des sous-titres sélectifs : d'où viennent les mots-clés (la liste EXISTANTE `MOTS_FORTS`, aucune liste inventée)
 * et quels groupes sont vidés (ceux sans mot fort ni nombre). Imports relatifs seulement, aucun service, aucun réglage.
 */
import { filtrerSelectif } from "../sous-titres/selectif";
import type { SegmentRendu } from "../sous-titres/types-rendu";
import { MOTS_FORTS, normaliser } from "../sous-titres/typographie";

/** Les mots des groupes dont la forme normalisée est un mot fort, sans doublon, dans l'ordre d'apparition. */
export function motsClesSelectif(groupes: readonly { mots: readonly { mot: string }[] }[]): string[] {
  const vus = new Set<string>();
  const forts: string[] = [];
  try {
    for (const g of groupes) {
      for (const m of g.mots) {
        const n = normaliser(m.mot);
        if (MOTS_FORTS.has(n) && !vus.has(n)) {
          vus.add(n);
          forts.push(m.mot);
        }
      }
    }
  } catch {
    return [];
  }
  return forts;
}

/**
 * Éteint (`actif` absent ou différent de `true`) : copie égale. Allumé : les groupes sans mot fort ni nombre gardent leurs
 * bornes et leurs champs mais n'ont plus de mots. Ne lève jamais : en cas d'erreur, copie égale (= éteint).
 */
export function segmentsSelectifs<T extends { id: string; debutSec: number; finSec: number; mots: { mot: string }[] }>(
  groupes: readonly T[],
  actif: boolean | undefined,
): T[] {
  try {
    if (actif !== true) return structuredClone(groupes) as T[];
    return filtrerSelectif(groupes as unknown as readonly SegmentRendu[], motsClesSelectif(groupes), true) as unknown as T[];
  } catch {
    return structuredClone(groupes) as T[];
  }
}
