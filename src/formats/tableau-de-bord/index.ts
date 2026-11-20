import { z } from "zod";
import type { DefinitionFormat } from "../types";
import { briquesAuChoix, CRITERES_STANDARD, migrationIdentite, REGLES_COMMUNES } from "../communs";

/**
 * FORMAT « TABLEAU DE BORD » (tableau-de-bord, code TB) — fiche G4-09b, générateur DÉDIÉ, VITRINE, MASQUÉ.
 *
 * Une courte vidéo faite UNIQUEMENT à partir des chiffres fournis (schéma `tableau-de-bord.v1`) : aucun chiffre ne vient d'ailleurs.
 * Statut `masque`, sans `ouvertDansLaNavigation`, sans `adresseCreation` : aucune page de saisie, aucun bouton visible.
 * Le moteur `montage-donnees` est en pause sans dépense tant que rien n'est relié ; voix et rendu réels = G4-09c.
 */
export const ID_FORMAT_TABLEAU_DE_BORD = "tableau-de-bord";
export const CODE_FORMAT_TABLEAU_DE_BORD = "TB";

export const formatTableauDeBord: DefinitionFormat = {
  id: ID_FORMAT_TABLEAU_DE_BORD,
  version: 1,
  nom: "Tableau de bord",
  nomCourt: "Tableau de bord",
  accroche: "Vos chiffres du mois, en vidéo",
  description: "Vos chiffres deviennent une courte vidéo : aucun nombre n'est ajouté, tout vient de votre tableau.",
  icone: "resultats",
  statut: "masque",
  famille: "motion",
  codeClassement: CODE_FORMAT_TABLEAU_DE_BORD,
  declinaison: "aucune",
  durees: { mode: "depuis-script", zoneSec: [20, 90], zoneOrangeSec: [90, 120], ciblesGenerationSec: [30, 45, 60], cibleParDefautSec: 45 },
  ratios: ["4:5", "9:16", "1:1", "16:9"],
  ratioMaitre: "4:5",
  miseEnPage: "plein-ecran",
  miseEnPageParRatio: { "4:5": "plein-ecran", "9:16": "plein-ecran", "1:1": "plein-ecran", "16:9": "plein-ecran" },
  /** Aucun personnage : la vidéo peut être muette (sous-titres seuls). */
  personnages: { min: 0, max: 1, roles: ["voix"], sources: ["double"] },
  entrees: [],
  etapes: ["express", "fabrication"],
  reglages: { schema: z.object({}), champs: [] },
  recetteScript: {
    blocs: [
      { id: "accroche", nom: "Accroche", couleur: "orange", consigne: "Le chiffre qui compte, en une phrase.", dureeCibleSec: [5, 15] },
      { id: "chiffres", nom: "Les chiffres", couleur: "sauge", consigne: "Un chiffre = une phrase, tirée de la donnée.", dureeCibleSec: [15, 60], repetable: true },
      { id: "conclusion", nom: "Conclusion", couleur: "orange-vif", consigne: "Ce qu'il faut retenir, sans aucun chiffre nouveau.", dureeCibleSec: [5, 20] },
    ],
    regles: [...REGLES_COMMUNES, "Aucun chiffre ne vient d'ailleurs que de la donnée fournie."],
    criteres: CRITERES_STANDARD,
    references: [],
    motsParSeconde: 2.6,
    modesDiction: ["voix-off"],
    modeParDefaut: "voix-off",
    annotations: ["emphase", "pause"],
  },
  briques: briquesAuChoix(),
  stylesParDefaut: { sousTitres: "st-avocat-v1", styleMontage: "sm-rythme", profilSon: "ps-voix-claire" },
  illustrations: { mode: "aucune", couvertureCiblePct: 0, dureePlanSec: 4, sourcesAutorisees: [], affichage: "plein-ecran" },
  accrocheVisuelle: { titreFixe: false, position: "haut" },
  musique: "interdite",
  capacitesRequises: ["voix", "motion"],
  moteur: "montage-donnees",
  reseauxConseilles: ["linkedin"],
  exemples: [],
  aFournir: ["Un tableau de chiffres au format tableau-de-bord.v1"],
  migrerReglages: migrationIdentite,
  ecranVideo: { attente: "generique", retouche: "operations", monteur: false, coutsVisibles: true, publication: "generique" },
  pieces: { sons: [], fin: "aucune", voix: "voix-maitre" },
};
