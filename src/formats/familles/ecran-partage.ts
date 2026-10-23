/**
 * Recette de la famille « écran partagé » (générateur, plan v5 B.4.0). PUR.
 * Texte dit et action à l'écran synchronisés ; ancrage démonstration possible (C60).
 * Un format de cette famille n'y déclare que ses différences (`resoudreRecette`).
 */
import type { RecetteFamille } from "./types";

export const recetteEcranPartage: RecetteFamille = {
  famille: "ecran-partage",
  modesDiction: ["teleprompteur", "trame", "voix-off"],
  declinaison: "ouverture-fin",
};
