import { z } from "zod";
import type { DefinitionFormat } from "../types";
import { briquesAuChoix, CRITERES_STANDARD, migrationIdentite, REGLES_COMMUNES } from "../communs";

/**
 * FORMAT « FACE CAMÉRA ANIMÉE » (facecam-animee, code FA) — plan `<dossier-de-plan-prive>/
 * PLAN-GENERATEUR-FACE-CAMERA-ANIMEE.md`, lot A « Socle ».
 *
 * NOUVEAU générateur, INDÉPENDANT du face caméra (décision de Will du 14/10) : Will se filme (sa voix, son visage, jamais
 * d'avatar) ; le studio monte dans le style « interface claire » de la référence LinkedIn : cartes claires qui tombent et
 * poussent l'image, étiquettes, logos, fenêtres photo qui se poussent, zooms coupés, sous-titres mot à mot, bruitages,
 * écran de fin — tout décidé d'après ce que Will dit (réalisateur Opus, lot C).
 *
 * Indépendance : sa propre fiche, son propre moteur (`montage-facecam-animee`), sa propre charte versionnée
 * (`interface-claire/1`, `studio-rendu/compositions/interface-claire/`). Les FONDATIONS (transcription, coupes, Look
 * Will, son, rendu, banques d'images) sont partagées par leurs versions figées : ce format s'y branche sans les modifier.
 * Aucune musique (ordre de Will) ; bruitages obligatoires ; aucune banque d'images payante.
 * Lot I (17/10/2026) : statut `actif` + `reserveAWill` (visible et lançable par Will seul : hors listes, page par son adresse, accord d'essai).
 */
/** 15 Go par prise (4K filmée à l'iPhone), comme le face caméra, sans dépendre de sa fiche. */
export const TAILLE_MAX_PRISE_FACECAM_ANIMEE = 15 * 1024 * 1024 * 1024;

export const formatFacecamAnimee: DefinitionFormat = {
  id: "facecam-animee",
  version: 1,
  nom: "Vidéo face caméra animée",
  nomCourt: "Face caméra animée",
  accroche: "Filmée par vous, animée sur vos mots",
  description: "Vous vous filmez, vous envoyez : le studio coupe, règle le son et l'image, puis anime chaque phrase (cartes, étiquettes, photos, sous-titres, bruitages).",
  icone: "video",
  adresseCreation: "/face-camera-animee",
  statut: "actif",
  /** Vidéos sur le site (lot S1) : conseil du plan, la décision est le réglage `siteGenerateurs.facecam-animee`. */
  site: "au-cas-par-cas",
  reserveAWill: true,
  famille: "face-camera",
  codeClassement: "FA",
  declinaison: "aucune",
  // Référence : 80 s ; la recette vise 60 à 80 s.
  durees: { mode: "depuis-script", zoneSec: [45, 90], zoneOrangeSec: [90, 150], ciblesGenerationSec: [60, 75, 90], cibleParDefautSec: 75 },
  ratios: ["9:16"],
  ratioMaitre: "9:16",
  miseEnPage: "plein-ecran",
  miseEnPageParRatio: { "9:16": "plein-ecran" },
  personnages: { min: 1, max: 1, roles: ["Face caméra"], sources: ["rush"] },
  entrees: [],
  etapes: ["express", "fabrication"],
  reglages: { schema: z.object({}), champs: [] },
  recetteScript: {
    // Recette d'écriture du 17/10 (décision de Will) : texte PARLÉ par Will face caméra, lu au téléprompteur ; l'écrit à l'écran
    // vient du montage, jamais du script. Fins : tirées de la base 7 selon le réseau, jamais écrites ici.
    blocs: [
      { id: "accroche", nom: "Accroche", couleur: "orange", consigne: "Dite en 3 s : la douleur du dirigeant, nommée sans introduction, puis une première réponse.", dureeCibleSec: [3, 5] },
      { id: "probleme", nom: "Problème", couleur: "sauge", consigne: "Une scène concrète qui montre ce que ça coûte : des tâches nommées, pas des idées.", dureeCibleSec: [8, 15] },
      { id: "corps", nom: "Corps", couleur: "sauge", consigne: "UNE seule idée, un exemple concret chiffré ; « voici ce qu'on met en place pour vous » : ce que nous mettons en place, jamais un geste à faire seul.", dureeCibleSec: [25, 45] },
      { id: "appel", nom: "Appel", couleur: "orange-vif", consigne: "Une seule action, tirée de la base 7 selon le réseau ; la conclusion revient vers ce que nous mettons en place.", dureeCibleSec: [4, 8] },
    ],
    regles: [
      ...REGLES_COMMUNES,
      "Texte dit par Will face caméra : la phrase doit se dire d'une traite.",
      "Chaque phrase nomme des choses concrètes : un nom dit = un élément animé (liste, chiffre, frise, fenêtre).",
      "Dire les chiffres en entier (« 12 heures », « 3 devis ») : le compteur à l'écran défile jusqu'au chiffre dit.",
      "Phrases de 14 mots au plus, une idée par phrase ; tutoiement ou vouvoiement selon l'adresse de la vidéo.",
      "Accroche en 3 s avec la douleur. Une valeur concrète, mais JAMAIS « faites-le vous-même » : on le met en place pour vous.",
      "Jamais d'annonce d'outil (« cet outil vient de sortir »). Les interdits permanents de Will (liste unique des interdits) s'appliquent.",
      "Durée : 30 à 75 s ; LinkedIn 45 à 75 s, Instagram, TikTok et Facebook 30 à 60 s.",
    ],
    criteres: CRITERES_STANDARD,
    references: [],
    motsParSeconde: 2.8,
    modeParDefaut: "teleprompteur",
    annotations: ["emphase", "illustration", "zoom", "pause"],
    ciblesSecondes: { corpsMax: 55, ouvertureMax: 5, appelMax: 8 },
    zonesDureeParReseau: { linkedin: [45, 75], instagram: [30, 60], tiktok: [30, 60], facebook: [30, 60] },
  },
  briques: briquesAuChoix(),
  stylesParDefaut: { lut: "lut-axion-naturel", sousTitres: "st-avocat-v1", styleMontage: "sm-rythme", profilSon: "ps-voix-claire" },
  // Fenêtres photo de 1 à 3 s posées sur l'image (référence : 11 en 80 s) ; Mes images puis banques gratuites.
  illustrations: { mode: "auto", couvertureCiblePct: 25, dureePlanSec: [1, 3], sourcesAutorisees: ["bibliotheque", "banque"], affichage: "incrustation" },
  accrocheVisuelle: { titreFixe: false, position: "haut" },
  musique: "interdite",
  export: { fps: 25, debitMbpsMin: 16, debitMbpsMax: 20, audio: { codec: "aac", kbps: 256, hz: 48000 }, couleur: "bt709" },
  capacitesRequises: ["rushs"],
  moteur: "montage-facecam-animee",
  reseauxConseilles: ["linkedin", "instagram", "tiktok", "youtube-shorts"],
  exemples: [],
  aFournir: ["Votre vidéo filmée (iPhone), avec votre voix"],
  migrerReglages: migrationIdentite,
  sansPrix: true,
  tailleMaxEnvoiOctets: TAILLE_MAX_PRISE_FACECAM_ANIMEE,
  pieces: {
    habillage: "interface-claire/1",
    sons: ["whoosh", "pop", "tic-tac", "frappe", "fin"],
    fin: "appels",
    voix: "prise-filmee",
    controleImage: true,
  },
};
