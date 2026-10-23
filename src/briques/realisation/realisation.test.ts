import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { controlerRealisation, ecartTaillePct, realiser, verifierGrammaire, type PisteVisage } from "./index";

/** Débit régulier de 2,6 mots par seconde ; un mot sur 7 est long (mot important). */
function parole(debut: number, fin: number): MotHorodate[] {
  const mots: MotHorodate[] = [];
  for (let t = debut, i = 0; t + 0.3 < fin; t += 0.385, i++) mots.push({ mot: i % 7 === 3 ? "transformation" : "et", debutSec: +t.toFixed(3), finSec: +(t + 0.3).toFixed(3) });
  return mots;
}

/** Visage quasi immobile, yeux à 34 % de la hauteur, légèrement à droite du centre. */
function piste(duree: number, bouge = false): PisteVisage {
  const echantillons = [];
  for (let t = 0; t <= duree; t += 0.12) echantillons.push({ t: +t.toFixed(2), yeuxX: 0.52 + (bouge && t > 20 ? 0.1 : 0), yeuxY: 0.34, boite: [0.45, 0.2, 0.14, 0.3] as [number, number, number, number], bouche: 0.2, confiance: 1 });
  return { version: 1, largeurSource: 3840, hauteurSource: 2160, imagesParSec: 25, echantillons, visageTrouvePct: 100 };
}

const SOURCE = { largeur: 3840, hauteur: 2160 };

describe("brique réalisation (plan v4 n° 18-19)", () => {
  // Montage de 40 s : passages gardés de longueurs variées (coupes de nettoyage à 1,2 s, 8 s, 9 s, 21 s).
  const gardes = [
    { debutSec: 15.1, finSec: 16.3 },
    { debutSec: 16.6, finSec: 23.4 },
    { debutSec: 23.8, finSec: 24.8 },
    { debutSec: 25.2, finSec: 37.2 },
    { debutSec: 37.6, finSec: 56.6 },
  ];
  const mots = gardes.flatMap((g) => parole(g.debutSec + 0.05, g.finSec - 0.05));
  const plan = realiser({ gardes, mots, piste: piste(60), source: SOURCE });
  const ctrl = controlerRealisation(plan);

  it("rythme Équilibré : un changement toutes les 2 à 3 s en moyenne, jamais plus de 6 s", () => {
    expect(plan.dureeSec).toBeCloseTo(40, 1);
    expect(ctrl.plansTropLongs).toEqual([]);
    expect(Math.max(...plan.plans.map((p) => p.finSec - p.debutSec))).toBeLessThanOrEqual(4.01);
    expect(ctrl.intervalleMoyenSec).toBeGreaterThanOrEqual(1.8);
    expect(ctrl.intervalleMoyenSec).toBeLessThanOrEqual(3);
  });

  it("chaque coupe de nettoyage change la taille d'au moins 12 % ; 3 tailles au plus (100 / 115 / 130)", () => {
    expect(ctrl.ecartsInsuffisants).toEqual([]);
    expect(new Set(plan.plans.map((p) => p.taille)).size).toBeLessThanOrEqual(3);
    expect(plan.plans.every((p) => [100, 115, 130].includes(p.taille))).toBe(true);
    for (const c of [16.3 - 15.1, 16.3 - 15.1 + 6.8]) {
      const i = plan.plans.findIndex((p) => Math.abs(p.debutSec - c) < 1e-3);
      if (i > 0) expect(ecartTaillePct(plan.plans[i - 1].taille, plan.plans[i].taille)).toBeGreaterThanOrEqual(12);
    }
  });

  it("punch-ins posés au début d'un mot, de préférence important ; coupes franches et instantanées seulement", () => {
    const punchs = plan.plans.filter((p) => p.ouverture === "punch-in");
    expect(punchs.length).toBeGreaterThan(3);
    const debutsMots = new Set(mots.map((m) => m.debutSec));
    for (const p of punchs) expect(debutsMots.has(+p.priseDebutSec.toFixed(3)) || mots.some((m) => Math.abs(m.debutSec - p.priseDebutSec) < 2e-3)).toBe(true);
    expect(punchs.filter((p) => p.motCle === "transformation").length / punchs.length).toBeGreaterThan(0.25); // 1 mot sur 7 est important
    expect(ctrl.grammaire).toEqual([]);
    expect(plan.raccords.every((r) => r.type === "franche" || r.type === "punch-in")).toBe(true);
  });

  it("cadre fixe par plan, yeux à 30-38 % de la hauteur, fenêtre 9:16 dans la source", () => {
    expect(ctrl.yeuxHorsBande).toEqual([]);
    for (const p of plan.plans) {
      expect(p.cadre.largeur / p.cadre.hauteur).toBeCloseTo(9 / 16, 2);
      expect(p.cadre.x).toBeGreaterThanOrEqual(0);
      expect(p.cadre.x + p.cadre.largeur).toBeLessThanOrEqual(3840);
      expect(p.cadre.y + p.cadre.hauteur).toBeLessThanOrEqual(2160);
      expect(p.cadre.largeur % 2 + p.cadre.x % 2).toBe(0);
    }
    const larges = plan.plans.filter((p) => p.taille === 100);
    expect(new Set(larges.map((p) => p.cadre.x)).size).toBe(1);
  });

  it("grain fort : 115 % au plus ; sans piste du visage : cadre centré, sans lever", () => {
    const fort = realiser({ gardes, mots, piste: piste(60), source: SOURCE, grainFort: true });
    expect(Math.max(...fort.plans.map((p) => p.taille))).toBe(115);
    expect(controlerRealisation(fort).ecartsInsuffisants).toEqual([]);
    const sans = realiser({ gardes, mots, source: SOURCE });
    expect(sans.plans[0].cadre.x).toBe(2 * Math.round((1920 - 1216 / 2) / 2));
    expect(realiser({ gardes: [], mots: [], source: SOURCE }).plans).toEqual([]);
  });

  it("rythme Sobre : changements plus espacés, toujours 6 s au plus", () => {
    const sobre = realiser({ gardes, mots, piste: piste(60), source: SOURCE, rythme: "sobre" });
    expect(controlerRealisation(sobre).plansTropLongs).toEqual([]);
    expect(sobre.plans.length).toBeLessThan(plan.plans.length);
  });
});

describe("grammaire de montage (v4 n° 19)", () => {
  it("refuse plus de 2 zooms flous, un fondu sur le visage, un zoom lent trop rapide, une entrée d'écran partagé hors 8-10 images", () => {
    const ecarts = verifierGrammaire({
      raccords: [
        ...Array.from({ length: 60 }, (_, i) => ({ tSec: i, type: "franche" as const })),
        { tSec: 31, type: "zoom-flou" },
        { tSec: 32, type: "zoom-flou" },
        { tSec: 33, type: "zoom-flou" },
        { tSec: 34, type: "fondu", surVisage: true },
        { tSec: 35, type: "entree-ecran-partage", dureeImages: 14 },
        { tSec: 36, type: "entree-ecran-partage", dureeImages: 9, courbe: "cubic-bezier(0.22, 1, 0.36, 1)" },
      ],
      mouvements: [
        { debutSec: 0, finSec: 4, deTaillePct: 100, aTaillePct: 115 },
        { debutSec: 10, finSec: 15, deTaillePct: 100, aTaillePct: 110 },
      ],
    });
    expect(ecarts.map((e) => e.code).sort()).toEqual(["entree-ecran-partage", "fondu-visage", "zoom-flou", "zoom-lent"]);
    expect(verifierGrammaire({ raccords: [{ tSec: 0, type: "fondu" }, { tSec: 1, type: "franche" }] }).map((e) => e.code)).toEqual(["coupes-franches"]);
  });
});
