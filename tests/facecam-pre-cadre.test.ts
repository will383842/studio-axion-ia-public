/**
 * FACECAM LOT C — mode « source pré-cadrée » 9:16 et paramètres FACULTATIFS de la composition (plan v4 B.8, B.9,
 * B.19, B.22, B.29) : absents, l'avocat rend exactement la même chose ; présents, une seule compression 8 bits.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, SegmentSousTitres } from "@/domaine/types";
import { decorsCatalogue } from "@/donnees/decors-catalogue";
import { ACCESSOIRE_MICRO, HABILLAGE_AVOCAT, PROFIL_SON_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { RECETTE_COMPOSITION_AVOCAT } from "@/moteurs/montage-avocat/recette-composition";
import type { PlanProduit } from "@/moteurs/types";
import { parametresComposition, transformation } from "@/briques/composition";
import type { ProprietesImageComposition } from "@/briques/composition/scene";
import { argumentsImageFfmpeg, tailleCanevas } from "../studio-rendu/src/composition/image-ffmpeg";
import { argumentsExport, grapheExport } from "../studio-rendu/src/composition/ffmpeg";

const MAINTENANT = "2026-10-09T08:00:00.000Z";
const plan = (ordre: number, de: number, a: number, extra: Partial<PlanProduit> = {}): PlanProduit => ({ ordre, debutSec: de, finSec: a, texte: "texte", segmentId: `s${ordre}`, sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, valeur: "large" }, transition: "coupe", angle: "trois-quarts", ...extra });

function commande(): CommandeFabrication {
  const n1 = decorsCatalogue(MAINTENANT).find((d) => d.id === "decor-n1-halo-orange")!;
  return {
    versionContrat: 2,
    moteurId: "montage-avocat",
    videoId: "v-c",
    formatId: "avocat",
    versionFormat: 2,
    profilRenduVersion: 1,
    dureeCibleSec: 12,
    ratios: ["9:16"],
    script: { blocs: [{ id: "b", blocRecette: "preuve", segments: [{ id: "s1", texte: "Trois questions." }] }], texteComplet: "" },
    distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: { "trois-quarts": { visageId: "vis-1" } } }],
    styles: {
      lut: { id: "lut-avocat-v1", nom: "Clair-obscur", intensite: 70, cible: ["personnage", "illustrations"], origine: "format" },
      sousTitres: { id: "st", nom: "Avocat", valeur: STYLE_SOUS_TITRES_AVOCAT },
      habillage: { id: "hab", nom: "Avocat", valeur: HABILLAGE_AVOCAT },
      profilSon: { id: "ps", nom: "Avocat", valeur: PROFIL_SON_AVOCAT },
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
    medias: { "decor-n1-halo-orange": { cle: "/demo/decors/fond-1-halo-orange.jpg", mime: "image/jpeg" }, "lut-avocat-v1": { cle: "/luts/axion-buffer-clair-obscur.cube", mime: "application/octet-stream", tailleCube: 65 } },
  } as CommandeFabrication;
}

const PLANS = [plan(1, 0, 3), plan(2, 3, 6, { cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1.15, valeur: "poitrine" } }), plan(3, 6, 12)];
const SEGMENTS: SegmentSousTitres[] = [
  { id: "g1", debutSec: 0.1, finSec: 0.8, mots: [{ mot: "Trois", debutSec: 0.1, finSec: 0.4 }, { mot: "questions", debutSec: 0.4, finSec: 0.8 }] },
  { id: "g2", debutSec: 7, finSec: 7.8, mots: [{ mot: "Où", debutSec: 7, finSec: 7.3 }, { mot: "fuit-elle", debutSec: 7.3, finSec: 7.8 }] },
];
const base = { ratio: "9:16" as const, plans: PLANS, segments: SEGMENTS, dureeSec: 12 };
const FICHIERS = { doubles: { principal: { fichier: "will.mp4", video: true } }, illustrations: {}, luts: [], son: "son.wav" };
const COULEURS = { grainPct: 3, grainTaillePx: 1.5, vignettePct: 10 };

describe("avocat : paramètres facultatifs absents = rendu d'aujourd'hui", () => {
  it("aucune nouvelle clé n'apparaît dans les paramètres de la composition", () => {
    const p = parametresComposition(commande(), base, RECETTE_COMPOSITION_AVOCAT);
    expect(p.image).not.toHaveProperty("sourcePreCadree");
    expect(p.image).not.toHaveProperty("source10bits");
    expect(p.export).not.toHaveProperty("source10bits");
    expect(p.texte.sousTitres).not.toHaveProperty("passagesJonction");
    expect(p.image.plans.every((x) => !x.ecranPartage)).toBe(true);
    expect(parametresComposition(commande(), { ...base, sourcePreCadree: undefined, source10bits: undefined, ecransPartages: [], positionSousTitresPct: undefined }, RECETTE_COMPOSITION_AVOCAT)).toEqual(p);
  });

  it("graphe FFmpeg et export inchangés sans les paramètres", () => {
    const p = parametresComposition(commande(), base, RECETTE_COMPOSITION_AVOCAT);
    const args = argumentsImageFfmpeg(p.image, COULEURS, FICHIERS, 12, "master.mov");
    expect(args).toContain("yuv420p");
    expect(args).not.toContain("yuv420p10le");
    expect(grapheExport()).toBe(grapheExport(false));
    expect(argumentsExport("m.mov", "t.txt", p.export, "j", "v.mp4").passe2.join(" ")).not.toContain("aq-mode");
  });
});

describe("mode pré-cadré 9:16", () => {
  it("la piste a déjà la taille du ratio : même géométrie, même graphe qu'une source 1080 × 1920", () => {
    const sans = parametresComposition(commande(), base, RECETTE_COMPOSITION_AVOCAT);
    const avec = parametresComposition(commande(), { ...base, sourcePreCadree: true }, RECETTE_COMPOSITION_AVOCAT);
    expect(avec.image.sourcePreCadree).toBe(true);
    const reste = { ...avec.image };
    delete reste.sourcePreCadree;
    expect(reste).toEqual(sans.image);
    for (const pl of avec.image.plans) for (const t of [pl.debutSec, (pl.debutSec + pl.finSec) / 2]) expect(transformation("9:16", pl, t, undefined, true)).toEqual(transformation("9:16", pl, t));
    expect(tailleCanevas(avec.image)).toEqual({ largeur: 1080, hauteur: 1920 });
    expect(argumentsImageFfmpeg(avec.image, COULEURS, FICHIERS, 12, "master.mov")).toEqual(argumentsImageFfmpeg(sans.image, COULEURS, FICHIERS, 12, "master.mov"));
  });

  it("hors 9:16, la piste pré-cadrée remplit l'image (ni bandes ni double réduit)", () => {
    const pl = { debutSec: 0, finSec: 3, cadrage: { valeur: "large" as const, zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.4 } };
    expect(transformation("4:5", pl, 1, undefined, true).double).toEqual({ gauche: 0, haut: 0, largeur: 1080, hauteur: 1350 });
    expect(tailleCanevas({ ratio: "4:5", sourcePreCadree: true })).toEqual({ largeur: 1080, hauteur: 1350 });
  });

  it("source 10 bits : master 10 bits quasi sans perte, UNE compression 8 bits à l'export (aq-mode 3, tramage)", () => {
    const p = parametresComposition(commande(), { ...base, sourcePreCadree: true, source10bits: true }, RECETTE_COMPOSITION_AVOCAT);
    const master = argumentsImageFfmpeg(p.image, COULEURS, FICHIERS, 12, "master.mov");
    expect(master.join(" ")).toContain("-crf 8 -pix_fmt yuv420p10le -profile:v high10");
    expect(p.export.source10bits).toBe(true);
    const ex = argumentsExport("m.mov", "t.txt", p.export, "j", "v.mp4").passe2.join(" ");
    expect(ex).toContain("aq-mode=3");
    expect(ex).toContain("overlay=format=yuv444p10");
    expect(ex).toContain("sws_dither=ed,format=yuv420p");
  });

  it("écran partagé par passages : plans coupés aux bornes, entrée en 9 images, sous-titres à la jonction", () => {
    const p = parametresComposition(commande(), { ...base, sourcePreCadree: true, ecransPartages: [{ debutSec: 5, finSec: 9, carteCle: "cartes/liste.mp4", sourceY: 320 }] }, RECETTE_COMPOSITION_AVOCAT);
    const partages = p.image.plans.filter((x) => x.ecranPartage);
    expect(partages.map((x) => [x.debutSec, x.finSec])).toEqual([[5, 6], [6, 9]]);
    expect(partages.map((x) => x.ecranPartage!.entreeImages)).toEqual([9, 0]);
    expect(partages[1].ecranPartage!.carteDebutSec).toBe(1);
    expect(p.entrees["carte-ep-1"]).toBe("cartes/liste.mp4");
    expect(p.texte.sousTitres!.passagesJonction).toEqual([{ debutSec: 5, finSec: 9, centrePct: 50 }]);
    const graphe = argumentsImageFfmpeg(p.image as ProprietesImageComposition, COULEURS, { ...FICHIERS, cartes: { "carte-ep-1": "carte.mp4" } }, 12, "master.mov").join(" ");
    expect(graphe).toContain("overlay=x=0:y='640*(1-pow(2\\,-10*min(1\\,n/9)))/(1-pow(2\\,-10))'");
  });
});

describe("brique motion branchée sur la composition commune (avocat compris, paramètre facultatif)", () => {
  it("une carte plein écran devient un plan d'illustration vidéo, coupes franches", () => {
    const p = parametresComposition(commande(), { ...base, cartesPleinEcran: [{ debutSec: 2, finSec: 5, carteCle: "cartes/chiffre.mp4" }] }, RECETTE_COMPOSITION_AVOCAT);
    expect(p.image.plans.map((x) => [x.debutSec, x.finSec, x.type])).toEqual([[0, 2, "double"], [2, 5, "illustration"], [5, 6, "double"], [6, 12, "double"]]);
    expect(p.image.plans[1].illustration).toEqual({ url: "entree:carte-pe-1", video: true });
    expect(p.entrees["carte-pe-1"]).toBe("cartes/chiffre.mp4");
  });
});
