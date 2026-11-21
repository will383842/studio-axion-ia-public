import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { demandesRecollage, ENTREE_AVANT, ENTREE_VOIX, plagesARerendre, planRecollage } from "../../../src/briques/rendu-par-plages";
import { avecEmpreintes } from "../../../src/briques/plan-scenes/empreinte";
import type { PlanDeScenes, ScenePlan } from "../../../src/briques/plan-scenes/schema";
import { VERSION_PLAN_SCENES } from "../../../src/briques/plan-scenes/schema";
import { plagesARerendre as viaTutoriel } from "../../../src/moteurs/montage-tutoriel-outil/rendu-partiel";


const transition = { entree: "fondu", sortie: "fondu", dureeMs: 400 } as const;

/** 10 scènes de 2 s (50 images chacune) : film de 20 s = 500 images. */
function plan(): ReturnType<typeof avecEmpreintes> {
  const scenes: ScenePlan[] = [];
  for (let k = 0; k < 10; k++) {
    scenes.push({
      id: `s${k + 1}`, version: 1, mots: { premier: k, dernier: k }, debutMs: k * 2000, finMs: (k + 1) * 2000, niveau: 1, position: "centre", transition,
      piece: "carte-kpi",
      parametres: { libelle: "Devis (exemple)", valeur: 38, prefixe: "+", suffixe: " %", decimales: 0, tendance: "hausse", variation: "exemple" },
    } as ScenePlan);
  }
  const p: PlanDeScenes = {
    version: VERSION_PLAN_SCENES, format: { largeur: 1080, hauteur: 1920, fps: 25 }, facecam: false, dureeMs: 20000,
    habillage: { fond: "ivoire", accent: "terracotta" }, mots: [], scenes,
  };
  return avecEmpreintes(p);
}

const E = { fps: 25 as const, dureeTotaleImages: 500, transitionMaxMs: 800 };
const TRANS_IMG = 20; // 800 ms à 25 i/s

describe("plagesARerendre (brique commune)", () => {
  const p = plan();
  it("aucune scène → aucun", () => expect(plagesARerendre(p, [], E)).toEqual({ mode: "aucun", plages: [] }));
  it("une scène au milieu → une plage élargie de la transition", () => {
    expect(plagesARerendre(p, ["s5"], E)).toEqual({ mode: "plages", plages: [{ debut: 200 - TRANS_IMG, fin: 250 + TRANS_IMG }] });
  });
  it("deux scènes voisines → une plage fusionnée", () => {
    expect(plagesARerendre(p, ["s5", "s6"], E).plages).toEqual([{ debut: 200 - TRANS_IMG, fin: 300 + TRANS_IMG }]);
  });
  it("scène au début → bornée à 0", () => {
    expect(plagesARerendre(p, ["s1"], E).plages[0]).toEqual({ debut: 0, fin: 50 + TRANS_IMG });
  });
  it("70 % du film → entier", () => {
    expect(plagesARerendre(p, ["s1", "s2", "s3", "s4", "s5", "s6", "s7"], E)).toEqual({ mode: "entier", plages: [] });
  });
  it("images clés toutes les 25 images → bornes multiples de 25", () => {
    const cles = Array.from({ length: 20 }, (_, i) => i * 25);
    const r = plagesARerendre(p, ["s5"], { ...E, imagesCle: cles });
    expect(r.mode).toBe("plages");
    for (const pl of r.plages) {
      expect(pl.debut % 25).toBe(0);
      expect(pl.fin % 25).toBe(0);
    }
  });
  it("égale la fonction réexportée par le tutoriel", () => {
    expect(viaTutoriel).toBe(plagesARerendre);
    for (const ids of [[], ["s5"], ["s5", "s6"], ["s1"], ["s1", "s2", "s3", "s4", "s5", "s6", "s7"]]) {
      expect(viaTutoriel(p, ids, E)).toEqual(plagesARerendre(p, ids, E));
    }
  });
});

function contigus(r: ReturnType<typeof planRecollage>, total: number): void {
  expect(r.segments[0]?.debut).toBe(0);
  expect(r.segments[r.segments.length - 1]?.fin).toBe(total - 1);
  for (let i = 1; i < r.segments.length; i++) expect(r.segments[i]!.debut).toBe(r.segments[i - 1]!.fin + 1);
}

describe("planRecollage", () => {
  it("une plage au milieu → 3 segments avant / plage / avant, voix d'avant", () => {
    const r = planRecollage({ plages: [{ debut: 180, fin: 270 }], dureeTotaleImages: 500, fichierAvant: "a.mp4", voixAvant: "v.mp3" });
    expect(r.segments.map((s) => s.source)).toEqual(["avant", "plage", "avant"]);
    expect(r.voix).toBe("avant");
    contigus(r, 500);
  });
  it("plage au début → 2 segments ; sans voix → aucune", () => {
    const r = planRecollage({ plages: [{ debut: 0, fin: 70 }], dureeTotaleImages: 500, fichierAvant: "a.mp4" });
    expect(r.segments.map((s) => s.source)).toEqual(["plage", "avant"]);
    expect(r.voix).toBe("aucune");
    contigus(r, 500);
  });
  it("deux plages dans le désordre → ordonnées, index conservés, sans trou", () => {
    const r = planRecollage({ plages: [{ debut: 300, fin: 350 }, { debut: 10, fin: 40 }], dureeTotaleImages: 500, fichierAvant: "a.mp4" });
    expect(r.segments.filter((s) => s.source === "plage").map((s) => (s as { index: number }).index)).toEqual([1, 0]);
    contigus(r, 500);
  });
  it("même entrée = même sortie ; durée nulle = aucun segment", () => {
    const e = { plages: [{ debut: 5, fin: 9 }], dureeTotaleImages: 50, fichierAvant: "a.mp4" };
    expect(planRecollage(e)).toEqual(planRecollage(e));
    expect(planRecollage({ ...e, dureeTotaleImages: 0 }).segments).toEqual([]);
  });
});

describe("demandesRecollage (T-EXT-52c)", () => {
  const plan = planRecollage({ plages: [{ debut: 180, fin: 269 }], dureeTotaleImages: 500, fichierAvant: "a.mp4", voixAvant: "v.mp3" });
  const p = demandesRecollage(plan, { fps: 25, dureeTotaleImages: 500 });
  it("segments contigus en secondes (image fin comprise = (fin + 1) / 25), plage nommée, durée totale", () => {
    expect(p.segments).toEqual([
      { source: "avant", debutSec: 0, finSec: 7.2 },
      { source: "plage", entree: "plage-0", dureeSec: 3.6 },
      { source: "avant", debutSec: 10.8, finSec: 20 },
    ]);
    expect(p.dureeSec).toBe(20);
    // Les segments « avant » et « plage » couvrent exactement la durée : 7,2 + 3,6 + (20 − 10,8).
    expect(7.2 + 3.6 + (20 - 10.8)).toBeCloseTo(p.dureeSec, 9);
  });
  it("conversion images → secondes à 25 i/s", () => {
    const r = demandesRecollage(planRecollage({ plages: [{ debut: 25, fin: 49 }], dureeTotaleImages: 100, fichierAvant: "a.mp4" }), { fps: 25, dureeTotaleImages: 100 });
    expect(r.segments).toEqual([
      { source: "avant", debutSec: 0, finSec: 1 },
      { source: "plage", entree: "plage-0", dureeSec: 1 },
      { source: "avant", debutSec: 2, finSec: 4 },
    ]);
  });
  it("voix posée : nommée quand le plan la pose, absente sinon ; le fichier d'avant est toujours nommé", () => {
    expect(p.voix).toBe(ENTREE_VOIX);
    expect(p.avant).toBe(ENTREE_AVANT);
    const sans = demandesRecollage(planRecollage({ plages: [{ debut: 5, fin: 9 }], dureeTotaleImages: 50, fichierAvant: "a.mp4" }), { fps: 25, dureeTotaleImages: 50 });
    expect("voix" in sans).toBe(false);
  });
  it("même entrée = même sortie", () => expect(demandesRecollage(plan, { fps: 25, dureeTotaleImages: 500 })).toEqual(p));
});

describe("pureté de la brique", () => {
  it("n'importe ni moteur ni service", () => {
    const txt = readFileSync("src/briques/rendu-par-plages/index.ts", "utf8");
    expect(txt).not.toMatch(/montage-|@\/services/);
  });
});
