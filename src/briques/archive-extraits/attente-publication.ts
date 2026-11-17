/**
 * Politique « notées » (X4-11a) : tant qu'une vidéo n'est pas publiée, seuls les moments
 * `ecran-demo`, `capture-cas` ou `scene` sans visage ni texte incrusté sont proposables.
 * Fonction pure, aucun service, rien ne l'appelle encore (X4-11b l'appellera).
 */
import type { OrigineMoment } from "@/briques/note-extraits";
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";

export const ORIGINES_AVANT_PUBLICATION: readonly OrigineMoment[] = Object.freeze([
  "ecran-demo",
  "capture-cas",
  "scene",
] as OrigineMoment[]);

/** Origine absente → false (prudent). */
export function plageProposableAvantPublication(p: PlageExtrait): boolean {
  return (
    p.origine !== undefined &&
    ORIGINES_AVANT_PUBLICATION.includes(p.origine) &&
    !p.avecVisage &&
    !p.texteIncruste &&
    p.etat === "utilisable"
  );
}

/** Seul `true` exact active l'attente ; l'entrée n'est jamais modifiée. */
export function plagesProposables(fiche: FicheSourceExtraits): PlageExtrait[] {
  if (fiche.attentePublication === true) return fiche.plages.filter(plageProposableAvantPublication);
  return fiche.plages.filter((p) => p.etat === "utilisable");
}
