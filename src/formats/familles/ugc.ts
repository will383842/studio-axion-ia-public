/**
 * Recette de la famille « UGC » (générateur, plan v5 B.4.0). PUR.
 * Contenu spontané filmé au téléphone, face caméra (Will ou acteur déclaré) ; aucun avis client exigé.
 * Un format de cette famille n'y déclare que ses différences (`resoudreRecette`).
 */
import type { RecetteFamille } from "./types";

export const recetteUgc: RecetteFamille = {
  famille: "ugc",
  modesDiction: ["trame", "teleprompteur"],
  declinaison: "ouverture-fin",
};
