/**
 * C2-U7a : mot-clé en pavé (plaque derrière un mot de la ligne). PUR, sans React ni Remotion, aucun import `@/` :
 * lu par le rendu. Éteint par défaut : seul un style portant `texteEcran.pave` appelle `motsAPlaque`.
 */
import { estNombre, MOTS_FORTS, normaliser } from "./typographie";

/** Règle de choix des mots (copie de `texte-ecran.ts`, sans import). */
export type ReglePave = "forts" | "chiffres" | "forts-et-chiffres";

/** Plaque : marge de chaque côté du mot et rayon des coins, en em (taille de la lettre). */
export const PAVE = { margeXEm: 0.18, margeYEm: 0.04, rayonEm: 0.16 };

/**
 * Indices des mots à plaque d'un groupe : au plus un (le premier qui convient), jamais le mot `souligne` déjà
 * marqué. Liste vide si aucun mot ne convient.
 */
export function motsAPlaque(segment: { mots: { mot: string }[]; souligne?: number | null }, regle: ReglePave): number[] {
  const fort = regle !== "chiffres";
  const chiffre = regle !== "forts";
  for (let k = 0; k < segment.mots.length; k++) {
    if (k === segment.souligne) continue;
    const mot = segment.mots[k].mot;
    if ((chiffre && estNombre(mot)) || (fort && MOTS_FORTS.has(normaliser(mot)))) return [k];
  }
  return [];
}
