/**
 * Politique « notées » (X4-11c) : vidéo admise comme pour « prêtes » (la publication n'est pas exigée),
 * puis mise en attente tant qu'elle n'est pas publiée. Fonctions PURES, aucun appelant, tout éteint.
 * Imports de types et de la règle d'éligibilité seulement.
 */
import type { FicheSourceExtraits } from "../../domaine/archive-extraits";
import type { Video } from "../../domaine/types";
import { videoEligible, type ContexteEligibilite } from "./inscription";

export const POLITIQUE_NOTEES = "notees";

/** Vrai seulement pour la chaîne exacte « notees ». */
export function estPolitiqueNotees(v: unknown): boolean {
  return v === POLITIQUE_NOTEES;
}

export function eligibiliteNotees(
  video: Pick<Video, "estDemo" | "statut" | "corbeilleLe" | "etapeEditoriale">,
  c: Omit<ContexteEligibilite, "politique" | "cochee">,
): { eligible: boolean; raison?: string; attentePublication: boolean } {
  const r = videoEligible(video, { ...c, politique: "pretes" });
  if (!r.eligible) return { eligible: false, raison: r.raison, attentePublication: false };
  return { eligible: true, attentePublication: video.etapeEditoriale !== "publiee" };
}

/** Copie de la fiche ; `false` laisse le champ absent (fiche identique à celle du chantier 3). */
export function ficheAvecAttente(fiche: FicheSourceExtraits, attente: boolean): FicheSourceExtraits {
  const { attentePublication: _ancien, ...reste } = fiche;
  void _ancien;
  return attente ? { ...reste, attentePublication: true } : reste;
}
