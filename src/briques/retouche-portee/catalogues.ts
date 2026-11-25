/**
 * Portée déclarée de chaque opération de retouche (D4-F5). Une table par vocabulaire existant : on ne crée pas
 * de 7e vocabulaire d'opérations. Types seulement importés (aucune valeur, aucun code serveur).
 */
import type { TypeOperationRetouche } from "../operations";
import type { OperationMontage } from "../../moteurs/types";
import type { TypeOperationRetouche as TypeOperationTableau } from "../../moteurs/montage-tableau/retouches";
import type { TypeOperationRetoucheCasConcret } from "../../moteurs/montage-cas-concret/retouches";

/** `scenes` : scènes touchées re-rendues (0 €) ; `final` : réassemblage entier sans fournisseur payant ; `voix` : voix relue (payant) ; `claude` : appel à Claude ; `ia` : image, avatar ou clip IA (payant). */
export type PorteeOperation = "scenes" | "final" | "voix" | "claude" | "ia";

/** Chat : `src/briques/operations.ts` (`TYPES_OPERATIONS_RETOUCHE`). Seul `modifier-script` refait la voix (minutage : `src/services/retouche-chat/appliquer.ts:132`). */
export const PORTEE_CHAT: Readonly<Record<TypeOperationRetouche, PorteeOperation>> = {
  "changer-mot": "scenes",
  "ajouter-chiffre": "scenes",
  "changer-brique": "scenes",
  "decaler-scene": "scenes",
  "changer-habillage": "scenes",
  "ajouter-piece": "scenes",
  "retirer-piece": "scenes",
  "remplacer-piece": "scenes",
  "changer-transition": "scenes",
  "ajouter-dynamisme": "scenes",
  "ajuster-zoom": "scenes",
  "modifier-script": "voix",
  // G14-02 : tout ce qui suit se décale ou le passage final est refait ; aucune ne relit la voix.
  "couper-mots": "final",
  "changer-sous-titre": "final",
  "retirer-scene": "final",
  "changer-son": "final",
  deplacer: "final",
};

/**
 * Moteurs : `src/moteurs/types.ts:116-124`. `plansTouchesPar` (`src/services/modifications.ts:79-107`) ne refait que des plans,
 * sauf `refaireSegmentVoix` (voix relue). `remplacerIllustration` : `requete` peut lancer une image générée
 * (`source: "generee-ia"`, `src/moteurs/montage-avocat/fabrication-illustrations.ts:88`), donc `ia`.
 * `corrigerMot` : simple nouveau calque de sous-titres (`modifications.ts:101-103`).
 */
export const PORTEE_MOTEURS: Readonly<Record<OperationMontage["type"], PorteeOperation>> = {
  remplacerIllustration: "ia",
  // Passer un plan en « face » hors d'un passage déjà rendu demande un nouveau rendu d'avatar : le second angle n'est rendu que par passages
  // (`src/moteurs/montage-avocat/index.ts:128`, `:847-851`, `:1216-1217`), donc `ia` par prudence. `changerCadrage` = recadrage du même webm (`scenes`).
  changerAngle: "ia",
  changerCadrage: "scenes",
  deplacerIncrustation: "scenes",
  corrigerMot: "scenes",
  modifierTitre: "scenes",
  refaireSegmentVoix: "voix",
  ajusterRythme: "scenes",
  planScenes: "scenes",
  reglagesFilm: "scenes",
  plaquettesV4: "final",
};

/** Tableau : `CATALOGUE_RETOUCHES` (`src/moteurs/montage-tableau/retouches.ts:69-81`) : pages → scenes, fin → final, voix → voix. */
export const PORTEE_TABLEAU: Readonly<Record<TypeOperationTableau, PorteeOperation>> = {
  remplacerTexteLigne: "scenes",
  marquerMotImportant: "scenes",
  retirerMotImportant: "scenes",
  ajouterMarque: "scenes",
  retirerMarque: "scenes",
  remplacerDessin: "scenes",
  supprimerElement: "scenes",
  changerGeste: "scenes",
  deplacerScene: "scenes",
  changerFin: "final",
  modifierTexteDit: "voix",
};

/**
 * Cas concret : `src/moteurs/montage-cas-concret/retouches.ts:42-70`. Le corps a sa voix relue (touche « corps »).
 * `changer-mot` (avec `motDit`) change ce qui est dit : les fins concernées sont relues. `sans-le-mot` refait le plan des fins :
 * par prudence, on le compte aussi en voix (une fin nouvelle peut devoir être lue).
 */
export const PORTEE_CAS_CONCRET: Readonly<Record<TypeOperationRetoucheCasConcret, PorteeOperation>> = {
  "changer-phrase": "voix",
  "changer-chiffre": "voix",
  "retirer-etape": "voix",
  "deplacer-etape": "voix",
  "changer-mot": "voix",
  "sans-le-mot": "voix",
};
