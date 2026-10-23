/**
 * Recette de la famille « témoignage » (générateur, plan v5 B.4.0). PUR.
 * Parole d'un client réel : preuve cas-client avec accord (C2), répliques mot pour mot de matières parole-dirigeant avec accord, ou trame de questions (C54).
 * Un format de cette famille n'y déclare que ses différences (`resoudreRecette`).
 */
import type { RecetteFamille } from "./types";

export const recetteTemoignage: RecetteFamille = {
  famille: "temoignage",
  modesDiction: ["trame"],
  declinaison: "ouverture-fin",
};
