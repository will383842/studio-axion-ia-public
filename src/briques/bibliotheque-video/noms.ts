/**
 * Table unique des noms (N-16). Le catalogue (C1-U1), G2-02, AM-12 et AM-16 lisent ces noms ; on n'écrit jamais un
 * identifiant de capacité en dur ailleurs. Une fiche qui ajoute une capacité ajoute son nom ici (fichier ⚠ partagé :
 * une ligne par fiche, annoncée au journal).
 *
 * Module côté Studio seulement : jamais importé par `studio-rendu/**`. Aucun état, aucun réglage, aucun défaut.
 */
import type { FamilleCapacite, IdCapacite } from "./types";
import { CATALOGUE_BRIQUES } from "@/briques/plan-scenes/catalogue";
import { CATALOGUE_EFFETS_COMMUN } from "@/briques/monteur/effets";

/** Les 14 familles, dans l'ordre de `FamilleCapacite` (types.ts). */
export const FAMILLES_CAPACITE = [
  "texte", "ecran", "calque", "plan-scenes", "transition", "fond", "etalonnage",
  "son", "motion", "objet", "accroche", "rythme", "mention", "cadrage",
] as const satisfies readonly FamilleCapacite[];

/**
 * Identifiants fixes (PLAN-FINAL § 3.3, AM-16, AM-08, AM-09). Clé = identifiant en camelCase (sans point ni tiret).
 * Chantiers 10 (C10-15) et 11 (C11) : leurs 10 noms sont inscrits en fin de table (CATALOGUE-C10-C11-v21p).
 */
export const ID = {
  // texte
  texteMotDitAccent: "texte.mot-dit-accent",
  texteSousTitresV4: "texte.sous-titres-v4",
  texteSurlignageMarqueur: "texte.surlignage-marqueur",
  texteStyleVarie: "texte.style-varie",
  textePastilleAxion: "texte.pastille-axion",
  textePave: "texte.pave",
  texteNomOutil: "texte.nom-outil",
  texteNomOutilAutonome: "texte.nom-outil-autonome",
  texteBandeauNom: "texte.bandeau-nom",
  texteRepereEpaule: "texte.repere-epaule",
  texteLogoOutil: "texte.logo-outil",
  texteSortieAnimee: "texte.sortie-animee",
  texteEscalier: "texte.escalier",
  // ecran
  ecranClipV4: "ecran.clip-v4",
  ecranMosaiqueExtraits: "ecran.mosaique-extraits",
  ecranTelephoneExtrait: "ecran.telephone-extrait",
  // calque
  calqueTexteDerriereDouble: "calque.texte-derriere-double",
  calqueTexteDerrierePrise: "calque.texte-derriere-prise",
  // plan-scenes
  planScenesCasConcret: "plan-scenes.cas-concret",
  planScenesFacecam: "plan-scenes.facecam",
  planScenesFacecamAnimee: "plan-scenes.facecam-animee",
  planScenesTutorielOutil: "plan-scenes.tutoriel-outil", // N-02
  planScenesDemoFacecam: "plan-scenes.demo-facecam", // G3-11
  // transition
  transitionCoupe: "transition.coupe",
  transitionCasConcret: "transition.cas-concret",
  transitionImageVideo: "transition.image-video",
  transitionCommune: "transition.commune",
  transitionStyleMontage: "transition.style-montage",
  // fond
  fondVivant: "fond.vivant",
  fondLumiere: "fond.lumiere",
  // etalonnage
  etalonnageLutClairObscur: "etalonnage.lut-clair-obscur",
  etalonnageLutNaturelSelfie: "etalonnage.lut-naturel-selfie",
  etalonnageLutDoux: "etalonnage.lut-doux",
  etalonnageLutNuit: "etalonnage.lut-nuit",
  etalonnageLutNouvelle: "etalonnage.lut-nouvelle",
  // son
  sonBanqueStudio: "son.banque-studio",
  sonV4: "son.v4",
  sonRegistreCommun: "son.registre-commun",
  sonFamillesEtendues: "son.familles-etendues",
  sonSurTransition: "son.sur-transition",
  // motion
  motionCartesCommunes: "motion.cartes-communes",
  motionPlaquettesV4: "motion.plaquettes-v4",
  motionIconesBibliotheque: "motion.icones-bibliotheque",
  motionIconesAnimees: "motion.icones-animees",
  motionLottie: "motion.lottie",
  motionAvisClient: "motion.avis-client",
  // cadrage
  cadrageZoomClassique: "cadrage.zoom-classique",
  cadrageZoomAvocat: "cadrage.zoom-avocat",
  cadrageZoomDemo: "cadrage.zoom-demo",
  cadrageCameraCasConcret: "cadrage.camera-cas-concret",
  cadrageZoomV4: "cadrage.zoom-v4",
  // génériques (G2-02)
  texteSousTitres: "texte.sous-titres",
  planScenesGenerique: "plan-scenes.generique",
  sonPose: "son.pose",
  etalonnageLut: "etalonnage.lut",
  // objet (C9-03)
  objetTrait: "objet.trait",
  objetMarque: "objet.marque",
  objetEtiquette: "objet.etiquette",
  objetAppel: "objet.appel",
  objetChiffre: "objet.chiffre",
  objetEtape: "objet.etape",
  objetCartes: "objet.cartes",
  objetSchema: "objet.schema",
  objetEcran: "objet.ecran",
  objetReseauSchema: "objet.reseau-schema",
  objetManuscrit: "objet.manuscrit",
  objetEmoji: "objet.emoji",
  // X1-00 (tendances 2027, `prevu`)
  textePoidsVariable: "texte.poids-variable",
  texteMinimalDynamique: "texte.minimal-dynamique",
  ecranFenetreInclinee: "ecran.fenetre-inclinee",
  fondVerreDepoli: "fond.verre-depoli",
  transitionZoomMot: "transition.zoom-mot",
  transitionRaccordForme: "transition.raccord-forme",
  accrocheApercuFin: "accroche.apercu-fin",
  accrocheMotCle: "accroche.mot-cle",
  mentionIa: "mention.ia",
  rythmeBoucle: "rythme.boucle",
  // C10-15 (chantier 10, `prevu`)
  accrocheScript: "accroche.script",
  rythmeMesure: "rythme.mesure",
  etalonnageNoirBlanc: "etalonnage.noir-blanc",
  texteLueur: "texte.lueur",
  texteFondClair: "texte.fond-clair",
  // C11 (chantier 11)
  texteMarquesAuMot: "texte.marques-au-mot",
  texteSelectif: "texte.selectif",
  texteModeCarte: "texte.mode-carte",
  texteEffets: "texte.effets",
  texteAccentsRole: "texte.accents-role",
  // C11-C2-a (chantier 11, une capacité par module)
  cadrageCameraCouverture: "cadrage.camera-couverture",
  ecranCarteVideoArrondie: "ecran.carte-video-arrondie",
  ecranGrillesArchive: "ecran.grilles-archive",
  ecranEcransComposes: "ecran.ecrans-composes",
} as const satisfies Record<string, IdCapacite>;

/** Préfixe des 13 coulisses v4 : leurs identifiants sont construits par C1-U1, jamais écrits ici. */
export const PREFIXE_COULISSE_V4 = "motion.v4-coulisse." as const;

/** Renvois aux deux catalogues existants (on ne les recode pas). */
export const PIECES_PLAN_SCENES: readonly string[] = Object.keys(CATALOGUE_BRIQUES);
export const EFFETS_COMMUNS: readonly string[] = CATALOGUE_EFFETS_COMMUN.map((e) => e.type);

/** Liste réunie : capacités telles quelles, `piece:<id>`, `effet:<type>` : jamais de confusion possible. */
export const NOMS_CATALOGUE: readonly string[] = [
  ...Object.values(ID),
  ...PIECES_PLAN_SCENES.map((p) => `piece:${p}`),
  ...EFFETS_COMMUNS.map((e) => `effet:${e}`),
];

export function familleDe(id: IdCapacite): FamilleCapacite {
  return id.slice(0, id.indexOf(".")) as FamilleCapacite;
}

export function estIdCapacite(x: unknown): x is IdCapacite {
  if (typeof x !== "string") return false;
  const i = x.indexOf(".");
  if (i < 0) return false;
  return (FAMILLES_CAPACITE as readonly string[]).includes(x.slice(0, i)) && /^[a-z0-9.-]+$/.test(x.slice(i + 1));
}
