/**
 * Pioche d'un extrait classée par usage, sujet et note (X4-14a) : fonction pure, aucun appelant.
 * Côté Studio seulement, jamais importée par `studio-rendu/**`. Aucun hasard, aucune horloge :
 * le départage passe par la graine (sha256).
 */
import type { SujetExtrait, UsageExtrait } from "@/briques/note-extraits/types";
import { rangGraine } from "./graine";
import { cleUsageExtrait, type CandidatExtrait } from "./types";

export type CandidatNote = CandidatExtrait & {
  note?: number;
  sujet?: SujetExtrait | null;
  usages?: readonly UsageExtrait[];
  ancienneteJours?: number;
};

export interface BesoinExtrait { usage: UsageExtrait; sujet: SujetExtrait | null; graine: string }

const BONUS_SUJET = 30;

function score(c: CandidatNote, besoin: BesoinExtrait): number {
  const memeSujet = besoin.sujet !== null && c.sujet != null && c.sujet === besoin.sujet;
  return (memeSujet ? BONUS_SUJET : 0) + (c.note ?? 0) / 2;
}

/**
 * Garde ceux qui ont l'usage, exclut `dejaUtilisees` (clé `cleUsageExtrait`), puis classe :
 * notés avant non notés, score décroissant, plus ancien d'abord, puis rang de graine. Rien → null.
 */
export function choisirExtrait(
  candidats: readonly CandidatNote[],
  besoin: BesoinExtrait,
  dejaUtilisees: readonly string[],
): CandidatNote | null {
  const exclues = new Set(dejaUtilisees);
  const retenus = candidats
    .filter((c) => c.usages?.includes(besoin.usage) === true)
    .filter((c) => !exclues.has(cleUsageExtrait(c.elementId, c.plageId)))
    .map((c) => ({ c, cle: cleUsageExtrait(c.elementId, c.plageId), s: score(c, besoin), note: c.note !== undefined }));
  if (retenus.length === 0) return null;
  retenus.sort((a, b) => {
    if (a.note !== b.note) return a.note ? -1 : 1;
    if (a.s !== b.s) return b.s - a.s;
    const ageA = a.c.ancienneteJours ?? 0, ageB = b.c.ancienneteJours ?? 0;
    if (ageA !== ageB) return ageB - ageA;
    const ra = rangGraine(besoin.graine, a.cle), rb = rangGraine(besoin.graine, b.cle);
    return ra < rb ? -1 : ra > rb ? 1 : 0;
  });
  return retenus[0].c;
}
