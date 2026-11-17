/**
 * Pioche dans la brique de la note (X4-14b) : ré-export de `choisirExtrait` (X4-14a) et conversion pure
 * d'une plage disponible en candidat noté. Aucun appelant, aucune date (l'ancienneté est fournie), aucun hasard.
 */
import type { PlageDisponible } from "@/briques/archive-extraits/choix";
import type { CandidatNote } from "@/briques/bibliotheque-video/pioche-extraits";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";
import type { SujetExtrait, UsageExtrait } from "./types";

export { choisirExtrait } from "@/briques/bibliotheque-video/pioche-extraits";
export type { CandidatNote, BesoinExtrait } from "@/briques/bibliotheque-video/pioche-extraits";

/** Mêmes champs de base que `candidatsExtraits`, plus note, sujet, usages et ancienneté quand ils existent. */
export function candidatNote(d: PlageDisponible, capacite: IdCapacite, ancienneteJours?: number): CandidatNote {
  const c: CandidatNote = {
    id: d.cle,
    cle: d.cle,
    capacite,
    elementId: d.elementId,
    plageId: d.plage.id,
    debutSec: d.plage.debutSec,
    finSec: d.plage.finSec,
    ratio: d.ratio,
    visage: d.plage.avecVisage ? "williams" : "aucun",
    texteIncruste: d.plage.texteIncruste,
    famille: [...d.famille],
    usages: (d.plage.usages ?? []).map((u) => u as UsageExtrait),
  };
  if (typeof d.plage.note === "number") c.note = d.plage.note;
  if (d.plage.sujet !== undefined) c.sujet = d.plage.sujet as SujetExtrait;
  if (ancienneteJours !== undefined) c.ancienneteJours = ancienneteJours;
  return c;
}
