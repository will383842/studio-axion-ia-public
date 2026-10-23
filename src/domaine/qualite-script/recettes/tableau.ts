/**
 * RECETTE QUALITÉ · TABLEAU ANIMÉ (gabarit cadré, six passages). PUR.
 * Débit : 16,9 caractères dits par seconde (`duree-tableau.ts` : 165 mots/min, recette `voix-tableau/3`; cible à mesurer sur la 1re vraie vidéo). Les écrans sont décidés au
 * découpage en scènes : la règle « changement à l'écran » ne se mesure pas sur le script. Mots à l'écran : 2 à 6.
 */
import { CARACTERES_PAR_SECONDE_TABLEAU } from "@/domaine/duree-tableau";
import { ACCROCHE_MAX_SEC } from "@/domaine/scripts-tableau-controles";
import type { RecetteQualite } from "../types";

export const RECETTE_TABLEAU: RecetteQualite = {
  id: "tableau",
  libelle: "Tableau animé",
  debit: { unite: "caracteres", parSeconde: CARACTERES_PAR_SECONDE_TABLEAU },
  reseaux: ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"],
  faceCamera: false,
  ecransReels: false,
  demandeFinale: "demande",
  interdits: "tableau",
  structures: [{ id: "gabarit-cadre", parties: ["accroche", "douleur", "promesse", "corps", "exemple", "a-retenir", "appel"] }],
  ecarts: {
    motsEcritsMax: { valeur: 6, raison: "Tableau : 2 à 6 mots à l'écran par phrase (règles du gabarit cadré)." },
    // Lot B2b : à 16,9 caractères/s (165 mots/min) le seuil commun de 3 s ne laisse que ~50 caractères, alors que la 1re
    // phrase peut compter 12 mots (~75 caractères, 4,4 s à 2,75 mots/s). AC-02 (alerte, observation seulement) se
    // déclenchait presque toujours : recalé sur `ACCROCHE_MAX_SEC` (4,4 s, la durée de 12 mots à ce débit, soit le refus de l'accroche de `BORNES_PASSAGES`, 12 mots au plus ; un test garde l'accord).
    premierePhraseFinSec: { valeur: ACCROCHE_MAX_SEC, raison: "Tableau : voix à 165 mots/min, 12 mots (maximum de la 1re phrase) = 4,4 s ; le seuil de 3 s se déclenchait dès ~50 caractères." },
  },
};
