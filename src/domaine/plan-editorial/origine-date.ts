/**
 * CAL-01 · origine de la date d'une entrée du calendrier (PUR : aucune lecture, aucune écriture).
 * Une date choisie à la main (« vous ») n'est jamais écrasée par une proposition de l'usine.
 * La définition de l'origine est dans types.ts (`OrigineEntree`) ; ce fichier ne la redéfinit pas.
 * En V1 rien n'alimente « usine » (porte v2) : une entrée sans origine date d'avant, donc d'un geste du fondateur.
 */
import { ORIGINES_ENTREE } from "./statuts";
import type { OrigineEntree } from "./types";

export type ResultatEcritureDate = { ok: true } | { ok: false; raison: string };

const estOrigine = (v: unknown): v is OrigineEntree => typeof v === "string" && (ORIGINES_ENTREE as readonly string[]).includes(v);

/**
 * Dit si une écriture de date est permise. `actuelle` : origine de la date en place (absente : choisie à la main,
 * donc protégée). `nouvelle` : origine de l'écriture demandée (obligatoire). Seule exception refusée : l'usine
 * ne remplace pas une date choisie par le fondateur. Origine illisible : refusé.
 */
export function ecritureDatePermise(actuelle: OrigineEntree | undefined, nouvelle: OrigineEntree): ResultatEcritureDate {
  if (!estOrigine(nouvelle)) return { ok: false, raison: "L'origine de la nouvelle date est illisible : rien n'est écrit." };
  if (actuelle !== undefined && !estOrigine(actuelle)) return { ok: false, raison: "L'origine de la date en place est illisible : rien n'est écrit." };
  const enPlace: OrigineEntree = actuelle ?? "vous";
  if (enPlace === "vous" && nouvelle === "usine") return { ok: false, raison: "Cette date est choisie par vous : l'usine ne la change pas." };
  return { ok: true };
}

/** Ce que la fiche dit de l'origine ; absente ou illisible : « choisie par vous » (jamais « usine » sans preuve). */
export function libelleOrigineDate(origine: OrigineEntree | undefined): string {
  return origine === "usine" ? "proposée par l'usine" : "choisie par vous";
}
