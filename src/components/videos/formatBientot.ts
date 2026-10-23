import type { StatutFormat } from "@/formats/types";

/**
 * Pastille « Bientôt » de /formats/[id] : format non actif qui n'est pas ouvert dans la navigation (Image → vidéo, essai).
 * Avoir des vidéos ne l'enlève pas.
 */
export function formatBientot(statut: StatutFormat, ouvert: boolean): boolean {
  return statut !== "actif" && !ouvert;
}

/** Titre de /formats/[id] : le nom du format pour un format Bientôt, « Mes vidéos » sinon. */
export function titrePageFormat(nomFormat: string, bientot: boolean): string {
  return bientot ? nomFormat : "Mes vidéos";
}
