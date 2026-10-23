/** Les recettes qualité des écrivains branchés sur le socle. */
import { RECETTE_CAS_CONCRET } from "./cas-concret";
import { RECETTE_ECRIRE_AVOCAT } from "./ecrire-avocat";
import { RECETTE_ECRIRE_FACECAM } from "./ecrire-facecam";
import { RECETTE_IMAGE_VIDEO } from "./image-video";
import { RECETTE_TABLEAU } from "./tableau";
import type { RecetteQualite } from "../types";

export { RECETTE_CAS_CONCRET, RECETTE_ECRIRE_AVOCAT, RECETTE_ECRIRE_FACECAM, RECETTE_IMAGE_VIDEO, RECETTE_TABLEAU };
export const RECETTES_QUALITE = [RECETTE_ECRIRE_AVOCAT, RECETTE_ECRIRE_FACECAM, RECETTE_TABLEAU, RECETTE_CAS_CONCRET, RECETTE_IMAGE_VIDEO] as const;

/** La recette « Écrire » d'un format du générateur (avocat, face caméra) ; aucune pour les autres formats. */
export function recetteQualiteEcrire(formatId: string | undefined): RecetteQualite | undefined {
  return RECETTES_QUALITE.find((r) => r.id === `ecrire-${formatId}`);
}
