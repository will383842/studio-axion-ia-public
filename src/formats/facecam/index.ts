import { z } from "zod";
import type { DefinitionFormat, ExportFormat } from "../types";
import { briquesAuChoix, CRITERES_STANDARD, migrationIdentite, REGLES_COMMUNES } from "../communs";

/**
 * FORMAT « FACE CAMÉRA » (facecam, code FC) — plan facecam v4 (docs/facecam/PLAN-FACECAM-v4.md), lot A « Fondations ».
 *
 * Will se filme à l'iPhone, à l'horizontale ; le studio monte tout seul (coupes, son, image, cadrage, sous-titres,
 * cartes). Famille `face-camera` INCHANGÉE (`recetteFaceCamera` n'est jamais touchée : l'avocat en hérite).
 * Statut `masque` pendant le chantier : il passe directement en `actif` au déploiement (v4 n° 28).
 *
 * Choix par défaut (v4 n° 30), chacun se changera ensuite dans Réglages, sans recoder :
 * - D1 : une seule ouverture pour tous les réseaux (`declinaison: "aucune"`) ;
 * - D2 et D13 : Claude pour les cas ambigus, la relecture et les cartes sur mesure (sous le plafond) ;
 * - D3 : remplace le Selfie (masqué) ; D4 : caméra arrière derrière la vitre (conseil de tournage) ;
 * - D5 : titre fixe pendant toute la vidéo ; D7 : aucune musique (aucune ambiance par défaut) ;
 * - D8 (import Drive) : plus tard ; D9 : banques d'images avec repli sur Mes images et les captures du site ;
 * - D10 et D12 (options IA payantes, Higgsfield) : coupées ; D11 (lampe, micro-cravate) : conseil seulement.
 * Fond : jamais décroché, flouté ni détouré PAR DÉFAUT (seulement assombri de 10 à 15 %) ; détourage à la demande.
 */

/** Une seule compression 8 bits, à la composition finale : 1080×1920, H.264 high, 16 à 20 Mb/s (v4 n° 8). */
const EXPORT_FACECAM: ExportFormat = { fps: 25, debitMbpsMin: 16, debitMbpsMax: 20, audio: { codec: "aac", kbps: 256, hz: 48000 }, couleur: "bt709" };

/** 15 Go par prise : 4K HEVC filmée à l'iPhone (l'avocat garde 4 Go). */
export const TAILLE_MAX_PRISE_FACECAM = 15 * 1024 * 1024 * 1024;

export const formatFacecam: DefinitionFormat = {
  id: "facecam",
  version: 1,
  nom: "Vidéo face caméra",
  nomCourt: "Face caméra",
  accroche: "Filmée à l'iPhone, montée toute seule",
  description: "Vous vous filmez à l'iPhone, vous envoyez : le studio coupe, règle le son et l'image, cadre, sous-titre et anime.",
  icone: "camera",
  statut: "actif",
  /** Vidéos sur le site (lot S1) : conseil du plan, la décision est le réglage `siteGenerateurs.facecam`. */
  site: "au-cas-par-cas",
  famille: "face-camera",
  codeClassement: "FC",
  declinaison: "aucune",
  durees: { mode: "depuis-script", zoneSec: [45, 120], zoneOrangeSec: [120, 180], ciblesGenerationSec: [60, 90, 120], cibleParDefautSec: 90 },
  ratios: ["9:16"],
  ratioMaitre: "9:16",
  miseEnPage: "plein-ecran",
  miseEnPageParRatio: { "9:16": "plein-ecran" },
  personnages: { min: 1, max: 1, roles: ["Face caméra"], sources: ["rush"] },
  entrees: [],
  // Comme l'avocat, sans nouvelle clé d'étape : Coupes, Image, Cartes et Sous-titres seront des feuilles facultatives.
  etapes: ["express", "fabrication"],
  reglages: { schema: z.object({}), champs: [] },
  recetteScript: {
    blocs: [
      { id: "accroche", nom: "Accroche", couleur: "orange", consigne: "Le moment le plus fort, sans introduction.", dureeCibleSec: [2, 5] },
      { id: "corps", nom: "Corps", couleur: "sauge", consigne: "Une idée par phrase, dite comme à quelqu'un en face.", dureeCibleSec: [30, 90] },
      { id: "appel", nom: "Appel", couleur: "orange-vif", consigne: "Une seule action.", dureeCibleSec: [3, 8] },
    ],
    regles: [...REGLES_COMMUNES, "Ton oral : la phrase doit se dire d'une traite, face caméra."],
    criteres: CRITERES_STANDARD,
    references: [],
    motsParSeconde: 2.7,
    modeParDefaut: "teleprompteur",
    annotations: ["emphase", "illustration", "zoom", "pause"],
  },
  briques: briquesAuChoix(),
  stylesParDefaut: { lut: "lut-axion-naturel", sousTitres: "st-avocat-v1", styleMontage: "sm-rythme", profilSon: "ps-voix-claire" },
  // B-roll accordés au Look Will, 1,2 à 2,5 s ; pas d'image générée (D10 coupée).
  illustrations: { mode: "auto", couvertureCiblePct: 15, dureePlanSec: [1.2, 2.5], sourcesAutorisees: ["bibliotheque", "banque"], affichage: "plein-ecran" },
  accrocheVisuelle: { titreFixe: true, position: "haut" },
  export: EXPORT_FACECAM,
  capacitesRequises: ["rushs"],
  moteur: "montage-facecam",
  reseauxConseilles: ["tiktok", "instagram", "youtube-shorts", "linkedin"],
  exemples: [],
  aFournir: ["Votre vidéo filmée à l'iPhone, à l'horizontale"],
  migrerReglages: migrationIdentite,
  sansPrix: true,
  tailleMaxEnvoiOctets: TAILLE_MAX_PRISE_FACECAM,
};
