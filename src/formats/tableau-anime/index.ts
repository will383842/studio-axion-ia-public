import { z } from "zod";
import type { DefinitionFormat, StructureRecette } from "../types";
import { CRITERES_STANDARD, migrationIdentite, REGLES_COMMUNES } from "../communs";

/**
 * FORMAT « TABLEAU ANIMÉ » (code TB) — plan tableau animé, 02-FORMAT-TABLEAU-ANIME.md § 2 et § 5 (tâche TB-10).
 *
 * Une voix off, un tableau où le texte s'écrit et se dessine au trait. Aucun visage. Famille `motion` INCHANGÉE : la
 * recette de famille n'est pas touchée, le format déclare ses différences (pas de bloc `appel` ni `boucle`, aucune
 * déclinaison par réseau : la fin par réseau est une pièce commune, `pieces.fin`).
 * Statut `actif` : allumé le 12/10/2026 sur décision du propriétaire (visible des menus et de « Nouvelle vidéo »).
 * Moteur `montage-tableau` (TB-11) : le moteur s'inscrit lui-même (`src/moteurs/montage-tableau`), ses raccords réels sont
 * posés par les services (`tableau-branchements.ts`).
 * Aucune musique en version 1. Sous-titres obligatoires ; mention IA au choix, coupée par défaut.
 */

/** Les quatre structures, déclarées comme DONNÉES (le générateur les lit comme les autres, il n'est pas modifié). */
export const STRUCTURES_TABLEAU_ANIME: StructureRecette[] = [
  {
    id: "TB.erreur-corrigee",
    nom: "L'erreur corrigée",
    enchainement: ["la douleur", "l'erreur que tout le monde fait", "la bonne façon (un geste)", "la preuve avant / après", "ce que vous gagnez", "la fin"],
    exigences: { appui: ["preuve"] },
  },
  {
    id: "TB.avant-apres",
    nom: "Avant / après",
    enchainement: ["la douleur", "« avant » : le résultat raté", "le changement (une consigne)", "« après »", "la fin"],
    exigences: { appui: ["preuve"] },
  },
  {
    id: "TB.demonstration",
    nom: "La démonstration en 3 gestes",
    enchainement: ["la promesse", "geste 1", "geste 2", "geste 3", "le résultat", "la fin"],
    exigences: { appui: ["preuve"] },
  },
  {
    id: "TB.question-abonne",
    nom: "Votre question",
    enchainement: ["la question (reformulée, sans nom ni pseudo)", "la réponse en un geste", "la preuve", "la fin"],
    exigences: { appui: ["preuve"] },
  },
];

export const formatTableauAnime: DefinitionFormat = {
  id: "tableau-anime",
  version: 1,
  nom: "Tableau animé",
  nomCourt: "Tableau animé",
  accroche: "Votre idée écrite et dessinée au trait",
  description: "Une voix, un tableau où le texte s'écrit et se dessine sous vos yeux. Aucun visage.",
  icone: "pinceau",
  adresseCreation: "/tableau/nouvelle",
  statut: "actif",
  /** Vidéos sur le site (lot S1) : conseil du plan, la décision est le réglage `siteGenerateurs.tableau-anime`. */
  site: "oui",
  chapitresWeb: { libelles: { geste: "Écran" } },
  famille: "motion",
  codeClassement: "TB",
  declinaison: "aucune",
  durees: { mode: "depuis-script", zoneSec: [30, 60], zoneOrangeSec: [60, 90], ciblesGenerationSec: [30, 45, 60], cibleParDefautSec: 45 },
  ratios: ["9:16"],
  ratioMaitre: "9:16",
  miseEnPage: "plein-ecran",
  miseEnPageParRatio: { "9:16": "plein-ecran" },
  // La voix seule : aucun visage n'est rendu (pas de capacité « visage »).
  personnages: { min: 1, max: 1, roles: ["voix"], sources: ["double"] },
  entrees: [],
  // Comme face caméra, sans nouvelle clé d'étape.
  etapes: ["express", "fabrication"],
  reglages: { schema: z.object({}), champs: [] },
  recetteScript: {
    blocs: [
      { id: "accroche", nom: "Accroche", couleur: "orange", consigne: "La douleur ou la question de votre public, sans introduction.", dureeCibleSec: [2, 5] },
      { id: "geste", nom: "Geste", couleur: "sauge", consigne: "Un geste à la fois, dit simplement et écrit au tableau.", dureeCibleSec: [4, 12], repetable: true },
      { id: "preuve", nom: "Preuve", couleur: "ambre", consigne: "Ce que l'on voit à l'écran : avant / après, résultat encadré.", dureeCibleSec: [4, 10] },
      { id: "resultat", nom: "Résultat", couleur: "orange-vif", consigne: "Ce que vous gagnez, en une phrase.", dureeCibleSec: [3, 8] },
    ],
    regles: [...REGLES_COMMUNES, "Vouvoiement : toujours « vous ».", "Une idée par scène, six mots au plus à l'écran."],
    // Pas de critère « appel » : le format n'écrit aucune phrase d'appel.
    criteres: CRITERES_STANDARD.filter((c) => c.id !== "appel"),
    references: [],
    motsParSeconde: 2.6,
    modesDiction: ["voix-off"],
    modeParDefaut: "voix-off",
    annotations: ["titreEcran", "emphase", "illustration"],
    structures: STRUCTURES_TABLEAU_ANIME,
    // Ni ouverture ni fin par réseau : la fin vient de la bibliothèque « Appels » (pièce commune).
    partiesDeclinaison: { ouverture: [], fin: [] },
  },
  // Sous-titres obligatoires (active) ; mention IA au choix, coupée par défaut ; aucune autre brique.
  briques: { "sous-titres": "active", "mention-ia": "au-choix-coupee" },
  // Sous-titres (17/10) : le style CENTRAL par défaut, celui de la face caméra et de l'avocat (« Avocat »), sauf choix de
  // la vidéo ; le moteur garde ses garde-fous (bande réservée, bande sombre de fond sur les fonds clairs).
  stylesParDefaut: { sousTitres: "st-avocat-v1" },
  illustrations: { mode: "aucune", couvertureCiblePct: 0, dureePlanSec: 3, sourcesAutorisees: [], affichage: "plein-ecran" },
  capacitesRequises: ["voix", "motion"],
  moteur: "montage-tableau",
  reseauxConseilles: ["instagram", "tiktok", "facebook"],
  exemples: [],
  aFournir: ["Un sujet", "Une preuve à montrer à l'écran"],
  migrerReglages: migrationIdentite,
  sansPrix: true,
  pieces: {
    // Style des nouvelles fiches : « reference/3 » (page écrite au crayon, gabarit par PARTIES : accroche, douleur,
    // solution, exemple, à retenir, appel ; 14/10). Les fiches déjà créées gardent le leur.
    habillage: "reference/3",
    stylo: "crayon/1",
    dessins: true,
    sons: ["ecriture", "page"],
    fin: "appels",
    voix: "voix-maitre",
    rendu: "par-scenes",
    controleImage: true,
  },
  ecranVideo: { attente: "generique", retouche: "operations", monteur: false, coutsVisibles: false },
};
