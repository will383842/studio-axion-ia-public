/**
 * BRIQUE MONTEUR — catalogue COMMUN des effets spéciaux (lot F3, branchés dans la chaîne par le lot I ; rangés ici à
 * l'intégration Z). PUR.
 *
 * Les trois demandes d'effets (objet 3D dans la main, vitre qui se brise, écran qui se plie / zoom à travers l'écran)
 * ne dépendent d'aucun format : tout format qui sait suivre une main (piste `/visages`) et poser une transition les
 * prend telles quelles dans son catalogue. Aujourd'hui seul le face caméra les rend ; l'avocat ne les propose pas.
 * Toujours À LA DEMANDE : jamais posés seuls par le monteur.
 */
import { OBJETS_MAIN } from "@/briques/effets-speciaux";
import type { EntreeCatalogueMonteur } from "./catalogue";

/** Opérations du monteur qui demandent un effet spécial. */
export type TypeOperationEffet = "objetMain" | "vitreBrisee" | "transitionEcran";

export const CATALOGUE_EFFETS_COMMUN: readonly EntreeCatalogueMonteur<TypeOperationEffet>[] = [
  {
    type: "objetMain",
    libelle: "Objet en 3D dans ma main (gratuit)",
    regle: `À LA DEMANDE SEULEMENT (« en 3D », gratuit ; une action réelle, « en réaliste », est un effetRealisteIA). debutMot-finMot : le passage où Will montre sa main ouverte (le studio suit la main, l'objet apparaît avec un éclat à l'ouverture, disparaît à la fermeture). objet : ${OBJETS_MAIN.join(", ")} (logo-axion par défaut). Jamais sur le visage ; un seul effet fort à la fois.`,
    exemples: ["Fais apparaître un logo 3D dans ma main quand je dis « voilà »", "Mets un téléphone en 3D dans ma main"],
  },
  {
    type: "vitreBrisee",
    libelle: "Vitre qui se brise",
    regle: "À LA DEMANDE SEULEMENT. auMot : le mot où l'image se brise (les éclats tombent et révèlent le plan suivant, ou une carte si revele = carte avec texteCarte). dureeSec 0,6 à 1,5 (null : 1,2). bruitage : true sauf si Will refuse le son. 3 transitions au plus par vidéo, 4 s d'écart.",
    exemples: ["Fais exploser l'écran comme une vitre quand je dis « stop »", "Brise l'écran et révèle « 3 erreurs à éviter »"],
  },
  {
    type: "transitionEcran",
    libelle: "Écran qui se plie, zoom à travers l'écran",
    regle: "À LA DEMANDE SEULEMENT. style ecran-plie (l'image se plie comme une feuille et s'envole) ou zoom-traversant (la caméra plonge à travers l'écran vers le plan suivant). auMot : le mot du passage ; dureeSec 0,6 à 1,5 (null : durée type).",
    exemples: ["Plie l'écran quand je passe au deuxième point", "Fais un zoom à travers l'écran sur « maintenant »"],
  },
];
