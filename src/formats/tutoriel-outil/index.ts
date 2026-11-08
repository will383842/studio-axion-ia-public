import { z } from "zod";
import type { DefinitionFormat } from "../types";
import { CRITERES_STANDARD, migrationIdentite, REGLES_COMMUNES } from "../communs";

/**
 * FORMAT « TUTORIEL D'OUTIL » (tutoriel-outil, code TO) — lot G, VITRINE.
 *
 * Part d'un script collé, ou d'un titre / d'une idée dont le studio écrit un script lisible et modifiable avant validation.
 * L'outil est montré en plein écran par du motion design (curseur, clics, zooms, frappe, légendes), sur la voix HeyGen
 * épinglée. Aucun visage. Lot I : le rendu est branché (`moteurs/montage-tutoriel-outil`) ; le format reste `masque`
 * jusqu'à la décision de Williams de le passer `actif`.
 */
export const ID_FORMAT_TUTORIEL_OUTIL = "tutoriel-outil";
export const CODE_FORMAT_TUTORIEL_OUTIL = "TO";

export const formatTutorielOutil: DefinitionFormat = {
  id: ID_FORMAT_TUTORIEL_OUTIL,
  version: 1,
  nom: "Tutoriel d'outil",
  nomCourt: "Tutoriel d'outil",
  accroche: "Un outil montré à l'écran, pas à pas",
  description: "Votre script ou une idée : le studio montre l'outil en plein écran (curseur, clics, zooms, frappe, légendes) sur une voix HeyGen. Pas de visage.",
  icone: "baguette",
  adresseCreation: "/tutoriel-outil",
  statut: "masque",
  famille: "motion",
  codeClassement: CODE_FORMAT_TUTORIEL_OUTIL,
  declinaison: "aucune",
  durees: { mode: "depuis-script", zoneSec: [30, 75], zoneOrangeSec: [75, 120], ciblesGenerationSec: [45, 60, 75], cibleParDefautSec: 60 },
  // Lot I : rendu maître en 4:5, puis les autres formats des réseaux.
  ratios: ["4:5", "9:16", "1:1"],
  ratioMaitre: "4:5",
  miseEnPage: "plein-ecran",
  miseEnPageParRatio: { "4:5": "plein-ecran", "9:16": "plein-ecran", "1:1": "plein-ecran" },
  personnages: { min: 0, max: 0, sources: [] },
  entrees: [],
  etapes: ["express", "fabrication"],
  reglages: { schema: z.object({}), champs: [] },
  recetteScript: {
    blocs: [
      { id: "accroche", nom: "Accroche", couleur: "orange", consigne: "Ce que l'outil permet de faire, en une phrase.", dureeCibleSec: [3, 6] },
      { id: "etapes", nom: "Les gestes", couleur: "sauge", consigne: "Un geste par phrase : où cliquer, quoi taper, ce qui s'affiche.", dureeCibleSec: [20, 55] },
      { id: "resultat", nom: "Résultat", couleur: "orange-vif", consigne: "Ce que l'on obtient à la fin, en une phrase.", dureeCibleSec: [4, 10] },
    ],
    regles: [...REGLES_COMMUNES, "Le script de Williams fait foi : le studio le propose, Williams le relit et le modifie avant validation.", "Un geste = une phrase = un mouvement à l'écran."],
    criteres: CRITERES_STANDARD,
    references: [],
    motsParSeconde: 2.6,
    modesDiction: ["voix-off"],
    modeParDefaut: "voix-off",
    annotations: ["emphase", "zoom", "pause"],
  },
  briques: { "sous-titres": "au-choix", son: "au-choix", "mention-ia": "au-choix-coupee" },
  stylesParDefaut: { sousTitres: "st-avocat-v1", styleMontage: "sm-rythme", profilSon: "ps-voix-claire" },
  illustrations: { mode: "aucune", couvertureCiblePct: 0, dureePlanSec: 2, sourcesAutorisees: [], affichage: "plein-ecran" },
  accrocheVisuelle: { titreFixe: false, position: "haut" },
  musique: "interdite",
  capacitesRequises: ["voix", "motion"],
  moteur: "montage-tutoriel-outil",
  reseauxConseilles: ["linkedin", "instagram", "youtube-shorts"],
  exemples: [],
  aFournir: ["Un script, ou un titre ou une idée de tutoriel"],
  migrerReglages: migrationIdentite,
  sansPrix: true,
  pieces: { sons: ["whoosh", "pop", "frappe"], fin: "appels", voix: "voix-maitre" },
};
