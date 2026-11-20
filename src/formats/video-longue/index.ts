import { z } from "zod";
import type { DefinitionFormat } from "../types";
import { briquesAuChoix, CRITERES_STANDARD, migrationIdentite, REGLES_COMMUNES } from "../communs";

/**
 * FORMAT « VIDÉO LONGUE » (video-longue, code VL) — fiche VL-03, générateur DÉDIÉ (option C, décision du 18/11/2026), VITRINE.
 *
 * Une vidéo horizontale 16:9 de 4 à 12 minutes pour YouTube, découpée en chapitres, sur la voix validée par l'utilisateur.
 * La durée vient du script : au-delà de la zone, le studio ajoute une REMARQUE, jamais un refus. Aucune musique.
 * Statut `masque`, sans `ouvertDansLaNavigation` : l'écran n'est joignable que par son adresse, aucune carte n'est ajoutée à la main.
 * Le moteur `montage-video-longue` est écrit par VL-04 ; l'inscription dans `src/formats/index.ts` est faite (will-dc). Pas d'`adresseCreation` tant que la page n'existe pas.
 */
export const ID_FORMAT_VIDEO_LONGUE = "video-longue";
export const CODE_FORMAT_VIDEO_LONGUE = "VL";

export const formatVideoLongue: DefinitionFormat = {
  id: ID_FORMAT_VIDEO_LONGUE,
  version: 1,
  nom: "Vidéo longue",
  nomCourt: "Vidéo longue",
  accroche: "Une vidéo de plusieurs minutes, en chapitres",
  description: "Votre script validé devient une vidéo horizontale découpée en chapitres, sur votre voix. Pas de musique ; vous gardez la main sur chaque phrase.",
  icone: "film",
  statut: "masque",
  famille: "motion",
  codeClassement: CODE_FORMAT_VIDEO_LONGUE,
  declinaison: "aucune",
  /** La durée vient du script. Zone verte 4 à 12 min ; au-delà, une remarque (jamais un refus). */
  durees: { mode: "depuis-script", zoneSec: [240, 720], zoneOrangeSec: [720, 1200], ciblesGenerationSec: [240, 360, 480, 600], cibleParDefautSec: 360 },
  ratios: ["16:9"],
  ratioMaitre: "16:9",
  miseEnPage: "plein-ecran",
  miseEnPageParRatio: { "16:9": "plein-ecran" },
  /** min 0 : le mode « Sans voix » (20/11) n'a aucun personnage. Avec voix, le personnage reste exigé : les branchements refusent « Choisissez qui parle. » avant tout port (motif sans-personnage). */
  personnages: { min: 0, max: 1, roles: ["voix"], sources: ["double"] },
  entrees: [],
  etapes: ["express", "fabrication"],
  reglages: { schema: z.object({}), champs: [] },
  recetteScript: {
    blocs: [
      { id: "accroche", nom: "Accroche", couleur: "orange", consigne: "Ce que la vidéo apporte, en une ou deux phrases.", dureeCibleSec: [10, 30] },
      { id: "chapitres", nom: "Les chapitres", couleur: "sauge", consigne: "Un chapitre = une idée, avec son titre. Une phrase = une idée.", dureeCibleSec: [180, 600], repetable: true },
      { id: "conclusion", nom: "Conclusion", couleur: "orange-vif", consigne: "Ce qu'il faut retenir, en quelques phrases.", dureeCibleSec: [15, 60] },
    ],
    regles: [...REGLES_COMMUNES, "Le script validé par l'utilisateur fait foi : aucune phrase n'est ajoutée sans son choix."],
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
  /** Aucune musique, quoi que dise la vidéo ou le modèle. */
  musique: "interdite",
  capacitesRequises: ["voix", "motion"],
  /** Moteur écrit par VL-04 (`src/moteurs/montage-video-longue/`). */
  moteur: "montage-video-longue",
  reseauxConseilles: ["youtube"],
  exemples: [],
  aFournir: ["Un script validé, découpé en chapitres"],
  migrerReglages: migrationIdentite,
  ecranVideo: { attente: "generique", retouche: "operations", monteur: false, coutsVisibles: true, publication: "generique" },
  pieces: { sons: [], fin: "aucune", voix: "voix-maitre" },
};
