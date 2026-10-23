/**
 * BRIQUE COMMUNE « composition » (centralisée le 02/10) : elle ne connaît aucun format, tout ce qui change d'un format
 * à l'autre passe par la RECETTE ; le moteur avocat, lié à sa recette, rend EXACTEMENT ce que rendait le lot M4b.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, SegmentSousTitres } from "@/domaine/types";
import { decorsCatalogue } from "@/donnees/decors-catalogue";
import { ACCESSOIRE_MICRO, HABILLAGE_AVOCAT, PROFIL_SON_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { parametresComposition as parametresAvocat } from "@/moteurs/montage-avocat/composition";
import { RECETTE_COMPOSITION_AVOCAT } from "@/moteurs/montage-avocat/recette-composition";
import type { PlanProduit } from "@/moteurs/types";
import { basDuDoubleAuBas, decorScene, parametresComposition, REDUCTION_LARGE_PAR_DEFAUT, transformation, type RecetteComposition } from ".";

const MAINTENANT = "2026-10-02T08:00:00.000Z";

function plan(ordre: number, de: number, a: number, extra: Partial<PlanProduit> = {}): PlanProduit {
  return { ordre, debutSec: de, finSec: a, texte: "texte", segmentId: `s${ordre}`, sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, valeur: "large" }, transition: "coupe", angle: "trois-quarts", ...extra };
}

function commande(extra: Partial<CommandeFabrication> = {}): CommandeFabrication {
  const n1 = decorsCatalogue(MAINTENANT).find((d) => d.id === "decor-n1-halo-orange")!;
  return {
    versionContrat: 2,
    moteurId: "montage-avocat",
    videoId: "v-brique",
    formatId: "avocat",
    versionFormat: 2,
    profilRenduVersion: 1,
    dureeCibleSec: 9,
    ratios: ["9:16", "4:5", "1:1"],
    script: { blocs: [{ id: "b", blocRecette: "preuve", segments: [{ id: "s3", texte: "Un client a économisé 2 500 € comme ça." }] }], texteComplet: "" },
    distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: { "trois-quarts": { visageId: "vis-1" } } }],
    styles: {
      lut: { id: "lut-avocat-v1", nom: "Clair-obscur", intensite: 70, cible: ["personnage", "illustrations", "rushs", "decor", "accessoire"], origine: "format" },
      sousTitres: { id: "st-avocat-v1", nom: "Avocat", valeur: STYLE_SOUS_TITRES_AVOCAT },
      habillage: { id: "hab-avocat-v1", nom: "Avocat", valeur: HABILLAGE_AVOCAT },
      profilSon: { id: "ps-avocat-v1", nom: "Avocat", valeur: PROFIL_SON_AVOCAT },
      musique: null,
      decor: { id: n1.id, nom: n1.nom, valeur: n1.valeur as never },
    },
    briques: { "sous-titres": true, etalonnage: true, illustrations: true, son: true, habillage: true, "texte-ecran": true, "mention-ia": false },
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { active: false } as never,
    budgetMax: { centimes: 15000, devise: "EUR" },
    accessoires: [{ id: "acc-micro-podcast", nom: "Micro", valeur: ACCESSOIRE_MICRO }],
    profilRealisme: formatAvocat.profilRendu?.realisme,
    profilRendu: formatAvocat.profilRendu,
    recetteMontage: RECETTE_MONTAGE_AVOCAT,
    construiteLe: MAINTENANT,
    sousTitres: { base: "karaoke", intensite: "equilibre" },
    medias: {
      "decor-n1-halo-orange": { cle: "/demo/decors/fond-1-halo-orange.jpg", mime: "image/jpeg" },
      "lut-avocat-v1": { cle: "/luts/axion-buffer-clair-obscur.cube", mime: "application/octet-stream", tailleCube: 65 },
    },
    ...extra,
  } as CommandeFabrication;
}

const PLANS: PlanProduit[] = [
  plan(1, 0, 3, { texteEcran: { texte: "Amende : l'erreur que tout le monde fait", position: "centre", style: "encadre", positionPct: 60 } }),
  plan(2, 3, 5, { cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1.2, valeur: "poitrine" } }),
  plan(3, 5, 9, { texte: "Un client a économisé 2 500 € comme ça.", segmentId: "s3", incrustation: { type: "montant", texte: "+ 2 500 €", sens: "gain" } }),
];
const SEGMENTS: SegmentSousTitres[] = [{ id: "g1", debutSec: 0.1, finSec: 0.8, mots: [{ mot: "Vous", debutSec: 0.1, finSec: 0.3 }, { mot: "recevez", debutSec: 0.3, finSec: 0.8 }] }];
const entree = (ratio: "9:16" | "4:5" | "1:1") => ({ ratio, plans: PLANS, segments: SEGMENTS, dureeSec: 9 });

/** Une autre recette (format imaginaire) : tout ce qu'elle change doit se voir, et rien d'autre. */
const AUTRE: RecetteComposition = {
  ...RECETTE_COMPOSITION_AVOCAT,
  id: "essai",
  decorRepli: { teinte: "#202020", directionLumiere: "gauche", flouPx: 0, clair: false },
  nomDecorRepli: "Gris d'essai",
  reductionLarge: { "9:16": 1, "4:5": 0.6, "1:1": 0.5 },
  centreSousTitres: { "9:16": 48, "4:5": 70, "1:1": 75 },
  incrustations: { hautPct: 40, montantTaillePx: 90, objetLargeurPct: 50, dureeMinSec: 0.4 },
  realisme: { grainPct: 1, grainTaillePx: 3, vignettePct: 2 },
  lutIntensiteParDefaut: 40,
};

describe("brique « composition » : aucun format n'y est écrit", () => {
  it("aucun fichier de la brique n'importe un format ou un moteur de format", () => {
    const dossier = __dirname;
    for (const f of readdirSync(dossier).filter((x) => x.endsWith(".ts") && !x.endsWith(".test.ts"))) {
      const texte = readFileSync(join(dossier, f), "utf8");
      expect(texte, f).not.toMatch(/from "[^"]*(formats\/(avocat|podcast)|moteurs\/montage-)[^"]*"/);
      expect(texte, f).not.toMatch(/ENCADRE_OUVERTURE_AVOCAT|RECETTE_MONTAGE_AVOCAT|RECETTE_COMPOSITION_AVOCAT/);
    }
  });

  it("la scène reste lisible par studio-rendu : aucun alias « @/ »", () => {
    expect(readFileSync(join(__dirname, "scene.ts"), "utf8")).not.toMatch(/from "@\//);
  });
});

describe("le moteur avocat = la brique + sa recette", () => {
  it("mêmes paramètres, à l'identique, dans les 3 formats d'image", () => {
    for (const r of ["9:16", "4:5", "1:1"] as const) expect(parametresAvocat(commande(), entree(r))).toEqual(parametresComposition(commande(), entree(r), RECETTE_COMPOSITION_AVOCAT));
  });

  it("la recette avocat garde les valeurs réglées aux lots M4 et M4b", () => {
    expect(RECETTE_COMPOSITION_AVOCAT.reductionLarge).toEqual({ "9:16": 1, "4:5": 0.85, "1:1": 0.72 });
    expect(RECETTE_COMPOSITION_AVOCAT.centreSousTitres).toEqual({ "9:16": 48, "4:5": 57, "1:1": 61 });
    expect(RECETTE_COMPOSITION_AVOCAT.decorRepli.teinte).toBe("#110A05");
    expect(RECETTE_COMPOSITION_AVOCAT.angles).toEqual({ principal: "trois-quarts", second: "face" });
  });
});

describe("une autre recette change ce qu'elle dit, rien d'autre", () => {
  it("réduction du double en plan large (4:5, 1:1), toujours ancré en bas ; 9:16 inchangé", () => {
    const pl = { debutSec: 0, finSec: 3, cadrage: { valeur: "large" as const, zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 } };
    expect(transformation("4:5", pl, 1, AUTRE.reductionLarge).double.hauteur).toBeCloseTo(1350 * 0.6);
    expect(transformation("4:5", pl, 1).double.hauteur).toBeCloseTo(1350 * REDUCTION_LARGE_PAR_DEFAUT["4:5"]);
    expect(basDuDoubleAuBas("1:1", pl, 1, AUTRE.reductionLarge)).toBe(true);
    expect(transformation("9:16", pl, 1, AUTRE.reductionLarge)).toEqual(transformation("9:16", pl, 1));
    const p = parametresComposition(commande(), entree("4:5"), AUTRE);
    expect(p.image.reductionLarge).toEqual(AUTRE.reductionLarge);
  });

  it("décor de repli et son nom, dit à Will", () => {
    const sansDecor = commande({ styles: { ...commande().styles, decor: undefined } });
    expect(decorScene(sansDecor, AUTRE).decor).toEqual(AUTRE.decorRepli);
    const look = commande({ styles: { ...commande().styles, decor: { id: "r1", nom: "Bureau", valeur: { type: "decor", mode: "image", methode: "look-heygen", profondeurFlou: 0, directionLumiere: "face", positionSujet: 0.5 } as never } } });
    expect(decorScene(look, AUTRE).alertes[0].message).toContain("Gris d'essai");
    expect(decorScene(look, RECETTE_COMPOSITION_AVOCAT).alertes[0].message).toContain("Halo orange");
  });

  it("aucun sous-titre ne chevauche une carte plein écran (9:16, 4:5, 1:1) ; les autres instants gardent les leurs", () => {
    const mot = (m: string, d: number, f: number) => ({ mot: m, debutSec: d, finSec: f });
    const segments: SegmentSousTitres[] = [
      { id: "avant", debutSec: 1, finSec: 2, mots: [mot("Bonjour", 1, 2)] },
      { id: "dedans", debutSec: 3.2, finSec: 4, mots: [mot("avec", 3.2, 3.5), mot("des", 3.5, 3.7), mot("aides", 3.7, 4)] },
      { id: "chevauche-fin", debutSec: 4.6, finSec: 5.4, mots: [mot("IA", 4.6, 5), mot("Certifexemple", 5, 5.4)] },
      { id: "apres", debutSec: 6, finSec: 7, mots: [mot("merci", 6, 7)] },
    ];
    for (const ratio of ["9:16", "4:5", "1:1"] as const) {
      const p = parametresComposition(commande(), { ratio, plans: PLANS, segments, dureeSec: 9, cartesPleinEcran: [{ debutSec: 3, finSec: 5, carteCle: "cartes/titre.mp4" }] }, RECETTE_COMPOSITION_AVOCAT);
      const ids = p.texte.sousTitres!.segments.map((s) => s.id);
      expect(ids, ratio).toEqual(["avant", "apres"]);
    }
  });

  it("sous-titres hors 9:16, incrustations, grain et intensité de LUT", () => {
    const avocat = parametresComposition(commande(), entree("4:5"), RECETTE_COMPOSITION_AVOCAT);
    const autre = parametresComposition(commande(), entree("4:5"), AUTRE);
    expect(autre.texte.sousTitres!.positions.milieuPct).toBeGreaterThan(avocat.texte.sousTitres!.positions.milieuPct);
    expect(autre.texte.incrustations[0].taillePx).toBe(Math.round(90));
    expect(avocat.texte.incrustations[0].taillePx).toBe(118);
    expect(autre.couleurs.grainTaillePx).toBe(3);
    const sansRealisme = commande({ profilRealisme: undefined, profilRendu: { ...formatAvocat.profilRendu!, realisme: undefined as never } });
    expect(parametresComposition(sansRealisme, entree("9:16"), AUTRE).couleurs).toMatchObject({ grainPct: 1, vignettePct: 2 });
    const sansIntensite = commande({ styles: { ...commande().styles, lut: { ...commande().styles.lut!, intensite: undefined as never } } });
    expect(parametresComposition(sansIntensite, entree("9:16"), AUTRE).couleurs.luts[0].intensite).toBeCloseTo(0.4);
    // Ce que la recette ne dit pas ne bouge pas : son, export, plans.
    expect(autre.son).toEqual(avocat.son);
    expect(autre.export).toEqual(avocat.export);
    expect(autre.image.plans).toEqual(avocat.image.plans);
  });
});
