/**
 * G12-09a-a : lecture stricte du projet gardé et refus motivé (purs, non branchés).
 * Plan de la fixture : `planValide()` de `tests/facecam-animee/plan-reference.ts` (passe `schemaPlanFacecamAnimee`, sans plaquette à vidéo).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { schemaPlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { etatInitialV4, type EtatChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { creerMoteurMontageFacecamAnimee } from "@/moteurs/montage-facecam-animee";
import { projetMontageV4 } from "@/moteurs/montage-facecam-animee/projet-v4";
import {
  CODE_RETOUCHE_GRATUITE_IMPOSSIBLE,
  lireProjetGardeV4,
  manquesRetoucheGratuiteV4,
  refusRetoucheGratuiteV4,
} from "@/moteurs/montage-facecam-animee/retouche-gratuite";
import { planValide } from "./plan-reference";

const FIN_PHRASE = "déposez la prise à nouveau pour une nouvelle mise en scène.";

function etatComplet(plan: unknown): EtatChaineV4 {
  return {
    ...etatInitialV4({ videoId: "v1", versionId: "ver1", priseCle: "prises/brute.mp4" }),
    transcription: { mots: [{ mot: "bonjour", debut: 0, fin: 0.5 }], dureeSec: 12, largeur: 1080, hauteur: 1920 },
    cadrage: { x: 10, largeur: 540, hauteur: 960, visage: true, centreX: 0.5 },
    coupes: { gardes: [{ debutSec: 0, finSec: 10 }], dureeSec: 10, mots: [] },
    realisation: { version: "complete", essais: 1, avertissements: 0, plan },
    rendu: { cle: "rendus/v.mp4", vignetteCle: "rendus/v.jpg", dureeSec: 10, taille: 1234, masterCle: "rendus/master.mp4" },
  } as unknown as EtatChaineV4;
}

const planAvecVideo = (medias: string[]) => ({
  ...planValide(),
  elementsV4: [{ id: "AvantApres", debut: 2, fin: 6, mots: ["a", "b", "c"], recherches: ["x"], medias }],
});
const projetAvecPlan = (plan: unknown, extra: Record<string, unknown> = {}) => ({ ...projetMontageV4(etatComplet(plan)), ...extra });

function geler<T>(x: T): T {
  if (x && typeof x === "object") {
    Object.values(x as object).forEach(geler);
    Object.freeze(x);
  }
  return x;
}

describe("fixtures", () => {
  it("les plans de test passent le schéma", () => {
    expect(schemaPlanFacecamAnimee.safeParse(planValide()).success).toBe(true);
    expect(schemaPlanFacecamAnimee.safeParse(planAvecVideo(["broll/a.mp4"])).success).toBe(true);
  });
});

describe("projet complet sans plaquette à vidéo", () => {
  const brut = projetMontageV4(etatComplet(planValide()));
  it("lu, égal en profondeur aux clés attendues ; aucun refus", () => {
    const p = lireProjetGardeV4(brut);
    expect(p).not.toBeNull();
    expect(p).toEqual(brut);
    expect(p!.priseCle).toBe("prises/brute.mp4");
    expect(manquesRetoucheGratuiteV4(brut)).toEqual([]);
    expect(refusRetoucheGratuiteV4(brut)).toBeNull();
  });
});

describe("projet illisible", () => {
  const ok = () => projetMontageV4(etatComplet(planValide()));
  const cas: [string, unknown][] = [
    ["null", null],
    ["42", 42],
    ["{}", {}],
    ["tableau", []],
    ["priseCle vide", { ...ok(), priseCle: "" }],
    ["priseCle absente", { ...ok(), priseCle: undefined }],
    ["plan illisible", { ...ok(), plan: { version: "?" } }],
    ["gardes vides", { ...ok(), gardes: [] }],
    ["gardes absentes", { ...ok(), gardes: undefined }],
    ["debut >= fin", { ...ok(), gardes: [{ debutSec: 5, finSec: 5 }] }],
    ["debut < 0", { ...ok(), gardes: [{ debutSec: -1, finSec: 5 }] }],
    ["NaN", { ...ok(), gardes: [{ debutSec: 0, finSec: Number.NaN }] }],
    ["garde nulle", { ...ok(), gardes: [null] }],
  ];
  it.each(cas)("%s", (_nom, x) => {
    expect(lireProjetGardeV4(x)).toBeNull();
    expect(manquesRetoucheGratuiteV4(x)).toEqual(["projet"]);
    const r = refusRetoucheGratuiteV4(x);
    expect(r?.code).toBe(CODE_RETOUCHE_GRATUITE_IMPOSSIBLE);
    expect(r?.code).toBe("RETOUCHE_GRATUITE_IMPOSSIBLE");
    expect(r?.message.endsWith(FIN_PHRASE)).toBe(true);
    expect(r?.message).toContain("Cette vidéo n'a pas gardé ce qu'il faut pour être refaite sans frais.");
  });
});

describe("plaquette à vidéo", () => {
  const plan = planAvecVideo(["broll/a.mp4"]);
  it("sans videos : manque", () => {
    const p = projetAvecPlan(plan);
    expect(manquesRetoucheGratuiteV4(p)).toEqual(["videos"]);
    const r = refusRetoucheGratuiteV4(p);
    expect(r?.message).toContain("Les vidéos d'illustration de cette version n'ont pas été gardées.");
    expect(r?.message.endsWith(FIN_PHRASE)).toBe(true);
    expect(r?.message).not.toMatch(/broll|a\.mp4|AvantApres/);
  });
  it("avec le bon fichier : rien ne manque", () => {
    const p = projetAvecPlan(plan, { videos: { fichiers: [{ nom: "a.mp4", cle: "x" }] } });
    expect(manquesRetoucheGratuiteV4(p)).toEqual([]);
    expect(refusRetoucheGratuiteV4(p)).toBeNull();
  });
  it("avec un autre nom : manque", () => {
    const p = projetAvecPlan(plan, { videos: { fichiers: [{ nom: "b.mp4", cle: "x" }] } });
    expect(manquesRetoucheGratuiteV4(p)).toEqual(["videos"]);
  });
});

describe("clés facultatives mal formées", () => {
  it("ignorées, sans refus", () => {
    const p = projetAvecPlan(planValide(), { cadrage: "x", videos: 3, transcription: 7, planScenes: "z", renduCle: 5 });
    const lu = lireProjetGardeV4(p)!;
    expect(lu).not.toBeNull();
    for (const k of ["cadrage", "videos", "transcription", "planScenes", "renduCle"]) expect(k in lu).toBe(false);
    expect(lu.vignetteCle).toBe("rendus/v.jpg");
    expect(refusRetoucheGratuiteV4(p)).toBeNull();
  });
  it("videos mal formées + plaquette qui en exige : seul « videos » manque", () => {
    const p = projetAvecPlan(planAvecVideo(["broll/a.mp4"]), { videos: 3 });
    expect(lireProjetGardeV4(p)).not.toBeNull();
    expect(manquesRetoucheGratuiteV4(p)).toEqual(["videos"]);
  });
});

describe("pureté", () => {
  it("entrée gelée en profondeur, non modifiée ; sortie indépendante ; deux appels égaux", () => {
    const entree = geler(projetAvecPlan(planValide(), { videos: { fichiers: [{ nom: "a.mp4", cle: "k" }] } }));
    const avant = JSON.stringify(entree);
    const a = lireProjetGardeV4(entree)!;
    const b = lireProjetGardeV4(entree)!;
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    a.gardes[0].finSec = 999;
    a.plan.duree = 1;
    a.videos!.fichiers[0].nom = "z";
    expect(JSON.stringify(entree)).toBe(avant);
    expect(manquesRetoucheGratuiteV4(entree)).toEqual(manquesRetoucheGratuiteV4(entree));
    expect(refusRetoucheGratuiteV4(entree)).toEqual(refusRetoucheGratuiteV4(entree));
  });
});

describe("éteint = identique", () => {
  it("refusRetouche du moteur : toujours RETOUCHE_NON_PRISE_EN_CHARGE", () => {
    const moteur = creerMoteurMontageFacecamAnimee();
    const r = moteur.refusRetouche!({ entrees: { facecamAnimee: { priseCle: "prises/brute.mp4" } } } as never);
    expect(r?.code).toBe("RETOUCHE_NON_PRISE_EN_CHARGE");
  });
  it("aucun fichier de src/ hors le fichier neuf ne cite retouche-gratuite", () => {
    const racine = join(process.cwd(), "src");
    const citeurs: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const c = join(d, n);
        if (statSync(c).isDirectory()) parcourir(c);
        // G12-09a-b 18/11 : reprise-rendu-v4.ts lit le type du projet gardé ; il n'est lui-même importé par personne (garde de reprise-rendu-v4.test.ts:97-110)
        else if (/\.(ts|tsx)$/.test(n) && !c.endsWith("retouche-gratuite.ts") && !c.endsWith("reprise-rendu-v4.ts") && readFileSync(c, "utf8").includes("retouche-gratuite")) citeurs.push(c);
      }
    };
    parcourir(racine);
    expect(citeurs).toEqual([]);
  });
});
