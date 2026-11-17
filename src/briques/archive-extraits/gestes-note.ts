/**
 * X4-12s : gestes de la note sur une plage ou une fiche (transformations pures).
 * Chaque fonction rend une copie, ou une chaîne de refus en français. Aucun dépôt, aucun réglage lu.
 * Tout éteint : appelée par personne tant que X4-12b n'est pas branchée.
 */
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";
import { TYPES_AUTOMATISATION } from "@/domaine/ciblage/types";
import type { SujetExtrait, UsageExtrait } from "@/briques/note-extraits/types";

/** Code de raison de note donné aux moments « chiffre » (voir `note-extraits/bareme.ts`, `POINTS.chiffre`). */
const CODE_CHIFFRE = "chiffre";
const PREUVE: UsageExtrait = "preuve-chiffree";

const SUJETS: readonly string[] = [...TYPES_AUTOMATISATION.map((t) => t.id), "appels-offres" satisfies SujetExtrait];

/** « Garder quand même » : valide la plage (survit à un recalcul via `reporterGestes`). */
export function garderQuandMeme(plage: PlageExtrait, maintenant: string): PlageExtrait | string {
  if (plage.etat === "exclue") return "Cet extrait ne peut pas être gardé.";
  return { ...plage, motsCles: [...plage.motsCles], valideeLe: maintenant };
}

/** « Changer le sujet » : un des 13 sujets, sinon refus. */
export function changerSujet(plage: PlageExtrait, sujet: string, maintenant: string): PlageExtrait | string {
  if (!SUJETS.includes(sujet)) return "Ce sujet n'existe pas.";
  return { ...plage, motsCles: [...plage.motsCles], sujet, sujetCorrigeLe: maintenant };
}

/** « Chiffres réels » : pose le drapeau, et la preuve chiffrée sur les seuls moments chiffre. */
export function marquerChiffresReels(fiche: FicheSourceExtraits, oui: boolean): FicheSourceExtraits {
  const plages = fiche.plages.map((p) => {
    const copie: PlageExtrait = { ...p, motsCles: [...p.motsCles] };
    if (!p.raisonsNote?.some((r) => r.code === CODE_CHIFFRE)) return copie;
    const usages = (p.usages ?? []).filter((u) => u !== PREUVE);
    copie.usages = oui ? [...usages, PREUVE] : usages;
    return copie;
  });
  return { ...fiche, plages, chiffresReels: oui };
}
