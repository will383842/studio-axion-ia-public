/**
 * Propriétés PAR DÉFAUT des compositions du tableau animé (TB-05) : de petites pages d'exemple, aux positions qu'en
 * donne la mise en page (`mise-en-page-tableau/2`, zone sûre de tous les réseaux 9:16). Les vraies propriétés arrivent
 * par la demande de rendu (`proprietesScenes`).
 * GÉNÉRÉ par tests/tableau/compositions/generer-exemples.mts : ne pas modifier à la main (un test le vérifie).
 */
import { VERSION_TABLEAU_SCENE, type PagePlacee, type ProprietesTableauScene, type Rect } from "./types";

const CADRE: Rect = {"px":{"x":79,"y":283,"largeur":793,"hauteur":792},"fraction":{"x":0.073148,"y":0.147396,"largeur":0.734259,"hauteur":0.4125}};
const ZONE_SURE: Rect = {"px":{"x":65,"y":269,"largeur":821,"hauteur":1075},"fraction":{"x":0.060185,"y":0.140104,"largeur":0.760185,"hauteur":0.559896}};
const BANDE: Rect = {"px":{"x":65,"y":1075,"largeur":821,"hauteur":269},"fraction":{"x":0.060185,"y":0.559896,"largeur":0.760185,"hauteur":0.140104}};

/** Page 1 de l'exemple « L'erreur corrigée » : accroche entourée + dessin, puis la douleur. */
export const PAGE_ACCROCHE: PagePlacee = {"page":1,"echelle":0.65,"occupation":0.852357,"elements":[{"elementId":"e01","sceneId":"s01","type":"ligne","niveau":"titre","taillePx":72,"couleurTexte":"#110A05","couleurFond":"#E9DCC8","role":"titre","marque":"entoure","ordre":0,"px":{"x":117,"y":340,"largeur":710,"hauteur":77},"fraction":{"x":0.108333,"y":0.177083,"largeur":0.657407,"hauteur":0.040104},"lignes":[{"texte":"Réponses vagues ?","px":{"x":117,"y":340,"largeur":710,"hauteur":77},"fraction":{"x":0.108333,"y":0.177083,"largeur":0.657407,"hauteur":0.040104}}],"encombrement":{"px":{"x":79,"y":306,"largeur":786,"hauteur":145},"fraction":{"x":0.073148,"y":0.159375,"largeur":0.727778,"hauteur":0.075521}}},{"elementId":"e02","sceneId":"s01","type":"dessin","dessinId":"point-interrogation","cote":"droite","ordre":1,"px":{"x":685,"y":469,"largeur":187,"hauteur":187},"fraction":{"x":0.634259,"y":0.244271,"largeur":0.173148,"hauteur":0.097396},"lignes":[],"encombrement":{"px":{"x":685,"y":469,"largeur":187,"hauteur":187},"fraction":{"x":0.634259,"y":0.244271,"largeur":0.173148,"hauteur":0.097396}}},{"elementId":"e03","sceneId":"s02","type":"ligne","niveau":"corps","taillePx":58,"couleurTexte":"#110A05","couleurFond":"#E9DCC8","role":"alerte","ordre":2,"px":{"x":79,"y":719,"largeur":581,"hauteur":69},"fraction":{"x":0.073148,"y":0.374479,"largeur":0.537963,"hauteur":0.035938},"lignes":[{"texte":"Question trop courte","px":{"x":79,"y":719,"largeur":581,"hauteur":69},"fraction":{"x":0.073148,"y":0.374479,"largeur":0.537963,"hauteur":0.035938}}],"encombrement":{"px":{"x":79,"y":719,"largeur":581,"hauteur":69},"fraction":{"x":0.073148,"y":0.374479,"largeur":0.537963,"hauteur":0.035938}}},{"elementId":"e04","sceneId":"s02","type":"dessin","dessinId":"bulle","cote":"gauche","ordre":3,"px":{"x":79,"y":806,"largeur":187,"hauteur":187},"fraction":{"x":0.073148,"y":0.419792,"largeur":0.173148,"hauteur":0.097396},"lignes":[],"encombrement":{"px":{"x":79,"y":806,"largeur":187,"hauteur":187},"fraction":{"x":0.073148,"y":0.419792,"largeur":0.173148,"hauteur":0.097396}}}],"gestes":[]};

/** Page 2 de l'exemple « L'erreur corrigée », réduite à sa ligne soulignée (un mot important). */
export const PAGE_LIGNE: PagePlacee = {"page":2,"echelle":1,"occupation":0.905707,"elements":[{"elementId":"e06","sceneId":"s04","type":"ligne","niveau":"corps","taillePx":77,"couleurTexte":"#110A05","couleurFond":"#E9DCC8","role":"regle","marque":"souligne","ordre":1,"px":{"x":84,"y":508,"largeur":580,"hauteur":182},"fraction":{"x":0.077778,"y":0.264583,"largeur":0.537037,"hauteur":0.094792},"lignes":[{"texte":"Trois questions","px":{"x":84,"y":508,"largeur":580,"hauteur":91},"fraction":{"x":0.077778,"y":0.264583,"largeur":0.537037,"hauteur":0.047396}},{"texte":"d'abord","px":{"x":84,"y":599,"largeur":293,"hauteur":91},"fraction":{"x":0.077778,"y":0.311979,"largeur":0.271296,"hauteur":0.047396}}],"encombrement":{"px":{"x":79,"y":508,"largeur":590,"hauteur":191},"fraction":{"x":0.073148,"y":0.264583,"largeur":0.546296,"hauteur":0.099479}}}],"gestes":[]};

/** Page 3 de l'exemple « Votre question », réduite à sa bulle de preuve (phrase testée réservée). */
export const PAGE_BULLE: PagePlacee = {"page":3,"echelle":0.8,"occupation":0.901985,"elements":[{"elementId":"e10","sceneId":"s05","type":"preuve","niveau":"corps","taillePx":61,"couleurTexte":"#110A05","couleurFond":"#E9DCC8","deuxColonnes":false,"ordre":0,"px":{"x":79,"y":286,"largeur":793,"hauteur":418},"fraction":{"x":0.073148,"y":0.148958,"largeur":0.734259,"hauteur":0.217708},"lignes":[{"texte":"Fermée : réponse claire","px":{"x":125,"y":496,"largeur":694,"hauteur":72},"fraction":{"x":0.115741,"y":0.258333,"largeur":0.642593,"hauteur":0.0375}}],"bulle":{"phrase":[{"texte":"« Posez une question","px":{"x":101,"y":308,"largeur":620,"hauteur":73},"fraction":{"x":0.093519,"y":0.160417,"largeur":0.574074,"hauteur":0.038021}},{"texte":"fermée »","px":{"x":101,"y":381,"largeur":260,"hauteur":73},"fraction":{"x":0.093519,"y":0.198438,"largeur":0.240741,"hauteur":0.038021}}],"zonePhrase":{"px":{"x":101,"y":308,"largeur":749,"hauteur":146},"fraction":{"x":0.093519,"y":0.160417,"largeur":0.693519,"hauteur":0.076042}},"rangeesPhrase":2,"etiquettes":[],"date":{"texte":"Testé le 09/10","px":{"x":101,"y":609,"largeur":411,"hauteur":73},"fraction":{"x":0.093519,"y":0.317188,"largeur":0.380556,"hauteur":0.038021}},"tailleLegende":58,"queue":{"px":{"x":123,"y":703,"largeur":28,"hauteur":21},"fraction":{"x":0.113889,"y":0.366146,"largeur":0.025926,"hauteur":0.010938}},"cercle":{"px":{"x":125,"y":496,"largeur":694,"hauteur":72},"fraction":{"x":0.115741,"y":0.258333,"largeur":0.642593,"hauteur":0.0375}}},"encombrement":{"px":{"x":79,"y":286,"largeur":793,"hauteur":438},"fraction":{"x":0.073148,"y":0.148958,"largeur":0.734259,"hauteur":0.228125}}}],"gestes":[]};

const commun = { version: VERSION_TABLEAU_SCENE, largeur: 1080, hauteur: 1920, fps: 25, stylo: "crayon/1", cadre: CADRE, zoneSure: ZONE_SURE, bandeSousTitres: BANDE, dejaEcrits: [], pagePrecedente: null, importants: {}, preuves: {} } as const;

/** `TableauScene` : la première scène (accroche visible dès la première image, entourée ; le dessin se trace). */
export const SCENE_EXEMPLE: ProprietesTableauScene = {
  ...commun,
  dejaEcrits: [],
  importants: {},
  preuves: {},
  scene: { id: "s01", page: 1, debutMs: 0, finMs: 3200, premiere: true },
  page: PAGE_ACCROCHE,
  heures: [
    { elementId: "e01", sceneId: "s01", debutMs: 0 },
    { elementId: "e02", sceneId: "s01", debutMs: 1450 },
  ],
};

/** `TableauLigneEcrite` : une ligne qui s'écrit, un mot important souligné d'orange, puis la ligne soulignée. */
export const LIGNE_EXEMPLE: ProprietesTableauScene = {
  ...commun,
  dejaEcrits: [],
  preuves: {},
  scene: { id: "s04", page: 2, debutMs: 0, finMs: 4000, premiere: false },
  page: PAGE_LIGNE,
  heures: [{ elementId: "e06", sceneId: "s04", debutMs: 300 }],
  importants: { e06: ["questions"] },
};

/** `TableauBullePreuve` : bulle neutre, phrase testée, ligne de résultat surlignée, « Testé le 09/10 ». */
export const BULLE_EXEMPLE: ProprietesTableauScene = {
  ...commun,
  dejaEcrits: [],
  importants: {},
  scene: { id: "s05", page: 3, debutMs: 0, finMs: 5000, premiere: false },
  page: PAGE_BULLE,
  heures: [{ elementId: "e10", sceneId: "s05", debutMs: 200 }],
  preuves: { e10: { phrase: "Posez une question fermée", testeLe: "2026-10-09" } },
};
