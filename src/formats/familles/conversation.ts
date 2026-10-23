/**
 * Recette de la famille « conversation » (générateur, plan v5 B.4.0). PUR.
 * Deux personnages ou plus (un intervenant par réplique). Invité réel : citations de matières avec accord, ou questions seulement ; invité joué déclaré (C54).
 * Un format de cette famille n'y déclare que ses différences (`resoudreRecette`).
 */
import type { RecetteFamille } from "./types";

export const recetteConversation: RecetteFamille = {
  famille: "conversation",
  modesDiction: ["teleprompteur", "trame"],
  declinaison: "ouverture-fin",
};
