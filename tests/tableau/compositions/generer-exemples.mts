/**
 * Régénère `studio-rendu/compositions/tableau/exemples.ts` (propriétés PAR DÉFAUT des compositions) depuis la VRAIE
 * mise en page des fiches d'exemple : les compositions n'importent rien de `src/moteurs/`, leurs exemples sont donc
 * recopiés ici. Un test vérifie qu'ils restent égaux à la mise en page.
 * Usage (depuis la racine) : npx tsx tests/tableau/compositions/generer-exemples.mts
 */
import { writeFileSync } from "node:fs";
import { pagesExemples } from "./exemples-attendus";

const { accroche, ligne, bulle, cadres } = pagesExemples();
const j = (v: unknown) => JSON.stringify(v);
const texte = `/**
 * Propriétés PAR DÉFAUT des compositions du tableau animé (TB-05) : de petites pages d'exemple, aux positions qu'en
 * donne la mise en page (\`mise-en-page-tableau/2\`, zone sûre de tous les réseaux 9:16). Les vraies propriétés arrivent
 * par la demande de rendu (\`proprietesScenes\`).
 * GÉNÉRÉ par tests/tableau/compositions/generer-exemples.mts : ne pas modifier à la main (un test le vérifie).
 */
import { VERSION_TABLEAU_SCENE, type PagePlacee, type ProprietesTableauScene, type Rect } from "./types";

const CADRE: Rect = ${j(cadres.cadre)};
const ZONE_SURE: Rect = ${j(cadres.zoneSure)};
const BANDE: Rect = ${j(cadres.bandeSousTitres)};

/** Page 1 de l'exemple « L'erreur corrigée » : accroche entourée + dessin, puis la douleur. */
export const PAGE_ACCROCHE: PagePlacee = ${j(accroche)};

/** Page 2 de l'exemple « L'erreur corrigée », réduite à sa ligne soulignée (un mot important). */
export const PAGE_LIGNE: PagePlacee = ${j(ligne)};

/** Page 3 de l'exemple « Votre question », réduite à sa bulle de preuve (phrase testée réservée). */
export const PAGE_BULLE: PagePlacee = ${j(bulle)};

const commun = { version: VERSION_TABLEAU_SCENE, largeur: 1080, hauteur: 1920, fps: 25, stylo: "crayon/1", cadre: CADRE, zoneSure: ZONE_SURE, bandeSousTitres: BANDE, dejaEcrits: [], pagePrecedente: null, importants: {}, preuves: {} } as const;

/** \`TableauScene\` : la première scène (accroche visible dès la première image, entourée ; le dessin se trace). */
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

/** \`TableauLigneEcrite\` : une ligne qui s'écrit, un mot important souligné d'orange, puis la ligne soulignée. */
export const LIGNE_EXEMPLE: ProprietesTableauScene = {
  ...commun,
  dejaEcrits: [],
  preuves: {},
  scene: { id: "s04", page: 2, debutMs: 0, finMs: 4000, premiere: false },
  page: PAGE_LIGNE,
  heures: [{ elementId: "e06", sceneId: "s04", debutMs: 300 }],
  importants: { e06: ["questions"] },
};

/** \`TableauBullePreuve\` : bulle neutre, phrase testée, ligne de résultat surlignée, « Testé le 09/10 ». */
export const BULLE_EXEMPLE: ProprietesTableauScene = {
  ...commun,
  dejaEcrits: [],
  importants: {},
  scene: { id: "s05", page: 3, debutMs: 0, finMs: 5000, premiere: false },
  page: PAGE_BULLE,
  heures: [{ elementId: "e10", sceneId: "s05", debutMs: 200 }],
  preuves: { e10: { phrase: "Posez une question fermée", testeLe: "2026-10-09" } },
};
`;
writeFileSync("studio-rendu/compositions/tableau/exemples.ts", texte, "utf8");
console.log("ok");
