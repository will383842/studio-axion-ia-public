/**
 * VALEURS des éléments de Bibliothèque du format avocat (plan du moteur avocat v3.2, B.0 §8, B.5, B.7).
 * Une seule source, partagée par les données de démonstration (base neuve) et par la migration au démarrage
 * (base déjà en ligne) : les deux installent exactement les mêmes éléments. PUR.
 */
import type { ElementBibliotheque, ValeurAccessoire, ValeurDecor, ValeurElement, ValeurProfilSon, ValeurStyleMontage, ValeurStyleSousTitres } from "@/domaine/types";

/**
 * Sous-titres de l'avocat (lot M2, décision de Will du 01/10) : base KARAOKÉ (Poppins ExtraBold 70 px, mot en cours en
 * orange, mots à venir à 45 %), mélangée d'accents Impact et Bandeau selon l'intensité de la vidéo. Contour noir
 * sous le remplissage (3 px visibles), centre à 48 %, emphase par le jeton `orange-vif` de la marque, chiffres alignés.
 * Le rendu lit `briques/sous-titres/style.ts` (gabarit) ; ces valeurs en sont les réglages de Bibliothèque.
 */
export const STYLE_SOUS_TITRES_AVOCAT: ValeurStyleSousTitres = {
  type: "style-sous-titres",
  gabarit: "karaoke",
  police: "Poppins ExtraBold",
  tailleRelative: 1,
  taillePx: 70,
  motsParLigne: 4,
  motsParLigneMin: 2,
  casse: "normale",
  animation: "surlignage",
  couleurAccent: "orange",
  jetonEmphase: "orange-vif",
  modeEmphase: "mot",
  position: "centre",
  positionPct: 48,
  contourPx: 6,
  ombrePx: 3,
  dureeMinGroupeSec: 0.4,
  dureeMaxGroupeSec: 0.9,
  chiffresAlignes: true,
};

/** Base calme (LinkedIn, sujets sérieux) : Minimal, Poppins Medium 60 px, une couleur, fondu de 120 ms. */
export const STYLE_SOUS_TITRES_MINIMAL: ValeurStyleSousTitres = {
  type: "style-sous-titres",
  gabarit: "minimal",
  police: "Poppins Medium",
  tailleRelative: 1,
  taillePx: 60,
  motsParLigne: 6,
  motsParLigneMin: 3,
  casse: "normale",
  animation: "aucune",
  couleurAccent: "creme",
  jetonEmphase: "orange-vif",
  modeEmphase: "mot",
  position: "centre",
  positionPct: 48,
  contourPx: 0,
  ombrePx: 2,
  dureeMinGroupeSec: 0.6,
  dureeMaxGroupeSec: 1.6,
  chiffresAlignes: true,
};

/** Plans de 2,5-3,5 s (1,5-2,5 s pendant les 6 premières secondes), coupes franches, aucun bruitage de transition (B.2). */
export const STYLE_MONTAGE_AVOCAT: ValeurStyleMontage = {
  type: "style-montage",
  rythme: "rythme",
  dureePlanMoyenneSec: 3,
  dureePlanMinSec: 2.5,
  dureePlanMaxSec: 3.5,
  dureePlanPlafondSec: 6,
  dureePlanOuvertureSec: [1.5, 2.5],
  ouvertureSec: 6,
  ruptureForteToutesLesSec: [10, 15],
  ecartCadrageMinPct: 15,
  zooms: "doux",
  transitions: "coupe",
  bruitagesTransitions: false,
};

/** Voix sèche, pas de musique, −14 LUFS (±1), crête vraie ≤ −1,5 dBTP, ton de pièce à −40/−45 dB (B.4, B.7). */
export const PROFIL_SON_AVOCAT: ValeurProfilSon = {
  type: "profil-son",
  volumeMusique: 0,
  baisseSousVoixDb: 0,
  traitementVoix: "sec",
  densiteBruitages: "aucun",
  niveauCibleLufs: -14,
  toleranceLufs: 1,
  creteVraieMaxDbtp: -1.5,
  ecartMaxLU: 3.5,
  tonPieceId: "ton-piece-will",
  tonPieceDb: [-45, -40],
  passeHautHz: 80,
  ratioCompression: 3,
};

/** Sans intro, sans fin, sans logo animé, sans carte finale ; encadré d'ouverture 0-3 s ; appel sur la dernière phrase. */
export const HABILLAGE_AVOCAT: Extract<ValeurElement, { type: "habillage" }> = {
  type: "habillage",
  intro: false,
  fin: false,
  logoAnime: false,
  grandTitre: false,
  encadreOuverture: { de: 0, a: 3 },
  appelSurDernierePhrase: true,
};

/** Noir chaud #16120F et lueur orange #C65A2E (B.3). Valeurs de la marque, réglées sur captures. */
export const DECOR_NOIR_CHAUD: ValeurDecor = {
  type: "decor",
  mode: "teinte",
  teinte: "#16120F",
  ambiance: "noir chaud, lueur orange",
  profondeurFlou: 12,
  teinteLumiere: "#C65A2E",
  directionLumiere: "gauche",
  positionSujet: 0.5,
};

/**
 * Micro de podcast : du côté où regarde l'orateur, devant lui, à hauteur du menton. Lot M4b (défaut vu sur la
 * démonstration : un rectangle gris flou coupé par le bord) : la CAPSULE reste entière dans l'image, en plan large
 * comme en plan poitrine à 120 % (seul son pied sort par le bas) ; x est le centre, y le haut de la capsule, dans le
 * cadre source ; flou LÉGER de 3 px (à 6-10 px, la forme ne se lisait plus). Écarts voulus à B.3 (« coupé par le
 * bord, x > 92 % », « flou 6-10 px »), à confirmer par Will sur capture ; réglables dans la Bibliothèque.
 */
export const ACCESSOIRE_MICRO: ValeurAccessoire = {
  type: "accessoire",
  positionParAngle: { "trois-quarts": { x: 0.78, y: 0.3, largeurPct: 22 }, face: { x: 0.78, y: 0.31, largeurPct: 21 } },
  flouPx: 3,
  cote: "regard",
};

/** Valeur du lot M0 (x 95 %, coupé par le bord), remplacée par la migration (étape 11) si personne n'y a touché. */
export const ACCESSOIRE_MICRO_V1: ValeurAccessoire = {
  type: "accessoire",
  positionParAngle: { "trois-quarts": { x: 0.95, y: 0.4, largeurPct: 22 }, face: { x: 0.95, y: 0.42, largeurPct: 20 } },
  flouPx: 8,
  cote: "regard",
};

/** LUT avocat v1 : « Axion Buffer Clair-obscur », 65 points (consigne `luts/A-INTEGRER-DANS-LE-STUDIO.md`). */
export const LUT_AVOCAT: Pick<ElementBibliotheque, "version" | "motsCles" | "valeur"> = {
  version: 1,
  motsCles: ["couleurs", "étalonnage", "clair-obscur", "avocat"],
  valeur: { type: "lut", formatFichier: "cube", tailleCube: 65, intensiteParDefaut: 70 },
};
