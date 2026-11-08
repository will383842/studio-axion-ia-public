import { z } from "zod";
import type { DefinitionFormat } from "../types";
import { briquesAuChoix, CRITERES_STANDARD, entree, migrationIdentite, REGLES_COMMUNES } from "../communs";

/**
 * FORMAT « DÉMO FACECAM » (demo-facecam, code DF) — lot G, VITRINE.
 *
 * Williams dépose une vidéo facecam ET une vidéo d'enregistrement d'écran, ou une seule vidéo. Écran partagé : facecam d'un côté,
 * écran réel de l'autre ; le motion design reste AUTOUR de l'écran, jamais devant le visage ; sous-titres calés. Lot J : le rendu
 * est branché (`moteurs/montage-demo-facecam`) ; le format reste `masque` jusqu'à la décision de Williams de le passer `actif`.
 */
export const ID_FORMAT_DEMO_FACECAM = "demo-facecam";
export const CODE_FORMAT_DEMO_FACECAM = "DF";
const TAILLE_MAX_VIDEO_DEMO_FACECAM = 15 * 1024 * 1024 * 1024;

export const formatDemoFacecam: DefinitionFormat = {
  id: ID_FORMAT_DEMO_FACECAM,
  version: 1,
  nom: "Démo facecam",
  nomCourt: "Démo facecam",
  accroche: "Vous et votre écran, côte à côte",
  description: "Déposez votre facecam et votre enregistrement d'écran (ou une seule vidéo) : écran partagé, motion design autour de l'écran, sous-titres calés.",
  icone: "ecran-partage",
  adresseCreation: "/demo-facecam",
  statut: "masque",
  famille: "ecran-partage",
  codeClassement: CODE_FORMAT_DEMO_FACECAM,
  declinaison: "aucune",
  durees: { mode: "depuis-script", zoneSec: [30, 90], zoneOrangeSec: [90, 150], ciblesGenerationSec: [45, 60, 90], cibleParDefautSec: 60 },
  // Lot J : rendu maître en 4:5 (moitié / moitié), puis les autres formats des réseaux.
  ratios: ["4:5", "9:16", "1:1"],
  ratioMaitre: "4:5",
  miseEnPage: "ecran-partage-haut-bas",
  miseEnPageParRatio: { "4:5": "ecran-partage-haut-bas", "9:16": "ecran-partage-haut-bas", "1:1": "ecran-partage-haut-bas" },
  personnages: { min: 1, max: 1, roles: ["Face caméra"], sources: ["rush"] },
  entrees: [
    entree("rushs", "Votre vidéo facecam", "Vous face caméra, avec votre voix.", { obligatoire: true, multiple: false, accepte: ["video/*"] }),
    entree("capture-ecran", "Votre enregistrement d'écran", "Facultatif : sans lui, l'écran est tiré de la vidéo facecam.", { obligatoire: false, multiple: false, accepte: ["video/*"] }),
  ],
  etapes: ["express", "fabrication"],
  reglages: { schema: z.object({}), champs: [] },
  recetteScript: {
    blocs: [
      { id: "accroche", nom: "Accroche", couleur: "orange", consigne: "Dite en 3 s : ce que la démo va montrer.", dureeCibleSec: [3, 6] },
      { id: "demo", nom: "La démo", couleur: "sauge", consigne: "Vous parlez pendant que l'écran montre le geste.", dureeCibleSec: [20, 70] },
      { id: "appel", nom: "Appel", couleur: "orange-vif", consigne: "Une seule action.", dureeCibleSec: [4, 8] },
    ],
    regles: [...REGLES_COMMUNES, "Texte dit par Williams face caméra : la phrase doit se dire d'une traite."],
    criteres: CRITERES_STANDARD,
    references: [],
    motsParSeconde: 2.8,
    annotations: ["emphase", "zoom", "pause"],
  },
  briques: briquesAuChoix(),
  stylesParDefaut: { lut: "lut-axion-naturel", sousTitres: "st-avocat-v1", styleMontage: "sm-rythme", profilSon: "ps-voix-claire" },
  illustrations: { mode: "aucune", couvertureCiblePct: 0, dureePlanSec: 2, sourcesAutorisees: [], affichage: "incrustation" },
  accrocheVisuelle: { titreFixe: false, position: "haut" },
  musique: "interdite",
  capacitesRequises: ["rushs", "ecran-partage"],
  moteur: "montage-demo-facecam",
  reseauxConseilles: ["linkedin", "instagram", "youtube-shorts"],
  exemples: [],
  aFournir: ["Votre vidéo facecam", "Votre enregistrement d'écran (facultatif)"],
  migrerReglages: migrationIdentite,
  sansPrix: true,
  tailleMaxEnvoiOctets: TAILLE_MAX_VIDEO_DEMO_FACECAM,
  pieces: { sons: ["whoosh", "pop"], fin: "appels", voix: "prise-filmee" },
};
