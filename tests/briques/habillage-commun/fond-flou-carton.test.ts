import { describe, expect, it } from "vitest";
import { fondFlouObjets } from "@/briques/motion/habillage-commun/fond-flou-objets";
import { FOND_FLOU_DEFAUT } from "@/briques/motion/habillage-commun/fond-flou-carte";
import { parametresComposition } from "@/briques/composition";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import type { CommandeFabrication } from "@/domaine/types";
import type { PlanValide } from "@/briques/plan-scenes/schema";

const scene = (id: string, debutMs: number, finMs: number, piece: string, calques?: unknown[]) => ({ id, version: 1, empreinte: "0123456789abcdef", mots: { premier: 0, dernier: 1 }, debutMs, finMs, niveau: calques ? 2 : 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, piece, parametres: {}, ...(calques ? { calques } : {}) });
const plan = (...scenes: unknown[]) => ({ version: "plan-scenes-1", format: { largeur: 1080, hauteur: 1920, fps: 25 }, facecam: true, dureeMs: 12000, habillage: { fond: "ivoire", accent: "terracotta" }, mots: [], scenes }) as unknown as PlanValide;
const CARTON = "objet-carton-magazine";
const FLOU = { flouPx: FOND_FLOU_DEFAUT.flouPx, assombrir: FOND_FLOU_DEFAUT.assombrir, fonduSec: FOND_FLOU_DEFAUT.fonduSec, cible: "decor" };

describe("fondFlouObjets (C10-04b)", () => {
  it("plan absent ou sans carton : []", () => {
    expect(fondFlouObjets(undefined)).toEqual([]);
    expect(fondFlouObjets(plan(scene("a", 0, 3000, "compteur"), scene("b", 3000, 6000, "objet-carton-definition")))).toEqual([]);
  });
  it("un carton de 3 à 6 s : une fenêtre exacte", () => {
    expect(fondFlouObjets(plan(scene("a", 0, 3000, "compteur"), scene("b", 3000, 6000, CARTON)))).toEqual([{ debutSec: 3, finSec: 6, ...FLOU }]);
  });
  it("deux cartons : deux fenêtres ordonnées, même donnés en désordre", () => {
    const r = fondFlouObjets(plan(scene("b", 8000, 10000, CARTON), scene("a", 3000, 6000, CARTON)));
    expect(r.map((f) => [f.debutSec, f.finSec])).toEqual([[3, 6], [8, 10]]);
  });
  it("un carton posé en calque d'une scène de niveau 2 compte, depuis son décalage", () => {
    const r = fondFlouObjets(plan(scene("n2", 2000, 7000, "compteur", [{ piece: CARTON, parametres: {}, debutMs: 1000, zone: "centre" }])));
    expect(r).toEqual([{ debutSec: 3, finSec: 7, ...FLOU }]);
  });
  it("jamais sur le visage : toutes les fenêtres visent le décor", () => {
    expect(fondFlouObjets(plan(scene("a", 0, 3000, CARTON))).every((f) => f.cible === "decor")).toBe(true);
  });
});

describe("parametresComposition : fondFlouCartes", () => {
  const c = { videoId: "v", formatId: "facecam", moteurId: "montage-facecam", ratios: ["9:16"], dureeCibleSec: 12, script: { blocs: [], texteComplet: "" }, distribution: [{ role: "Face caméra", source: "rush" }], briques: { etalonnage: true, "sous-titres": true, "mention-ia": false }, styles: { lut: null }, entrees: {}, reglages: {}, plans: [], prononciations: [], sousTitres: { base: "simple", intensite: "equilibre" } } as unknown as CommandeFabrication;
  const plans = [{ ordre: 1, debutSec: 0, finSec: 12, texte: "", segmentId: "facecam", sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.4 }, zoom: 1, valeur: "large" }, transition: "coupe", angle: "face" }] as never;
  const base = { ratio: "9:16" as const, plans, segments: [], dureeSec: 12, audioCle: "m.mov", pistesDouble: { face: "m.mov" }, pistesDepuisLook: true };
  it("sans carton : aucune clé ajoutée, paramètres identiques à ceux sans plan de scènes", () => {
    const sans = parametresComposition(c, base, RECETTE_COMPOSITION_FACECAM);
    const avec = parametresComposition(c, { ...base, planScenes: plan(scene("a", 0, 3000, "compteur")) }, RECETTE_COMPOSITION_FACECAM);
    expect("fondFlouCartes" in avec.image).toBe(false);
    expect("fondFlouCartes" in sans.image).toBe(false);
    expect(JSON.parse(JSON.stringify(avec.image))).toEqual({ ...JSON.parse(JSON.stringify(sans.image)), planScenes: expect.anything() });
  });
  it("avec un carton : la fenêtre est posée", () => {
    const p = parametresComposition(c, { ...base, planScenes: plan(scene("b", 3000, 6000, CARTON)) }, RECETTE_COMPOSITION_FACECAM);
    expect(p.image.fondFlouCartes).toEqual([{ debutSec: 3, finSec: 6, ...FLOU }]);
  });
});
