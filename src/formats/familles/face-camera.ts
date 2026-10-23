/**
 * Recette de la famille « face caméra » (générateur, plan v5 B.4.0). PUR.
 * Un personnage, regard caméra ou interlocuteur, coupes et recadrages ; un seul intervenant.
 * Un format de cette famille n'y déclare que ses différences (`resoudreRecette`).
 */
import type { RecetteFamille } from "./types";

export const recetteFaceCamera: RecetteFamille = {
  famille: "face-camera",
  modesDiction: ["avatar", "teleprompteur", "trame"],
  declinaison: "ouverture-fin",
};
