/**
 * BR-GARDE-FLASH-a (X1-15) · la garde des flashs lit les transitions communes réellement posées sur les tranches du cas concret.
 * Jamais bloquante : une remarque `FLASH` « À vérifier » en fin de `remarques`, jamais au mémo. Doubles seulement, 0 €.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FLASH_MESURE_ACTIVE, mesurerFlashs } from "@/briques/composition/garde-flash";
import type { PlanHabille } from "@/briques/motion/habillage-commun/types";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { planScenesCasConcret, cleTranche, type GroupePourPlan } from "@/moteurs/montage-cas-concret/plan-scenes";
import { DIX_SCRIPTS } from "../briques/faits-script/dix-scripts";

const etat = vi.hoisted(() => ({ rafale: 0 }));
vi.mock("@/moteurs/montage-cas-concret/habillage-plan", async (origine) => {
  const vrai = await origine<typeof import("@/moteurs/montage-cas-concret/habillage-plan")>();
  return {
    ...vrai,
    habillerTranches: (o: Parameters<typeof vrai.habillerTranches>[0]) => {
      if (!etat.rafale) return vrai.habillerTranches(o);
      // Double : chaque tranche reçoit `rafale` scènes de 250 ms, toutes entrées en « flash-ivoire », sans toucher au reste.
      const sortie: Record<string, PlanValide> = { ...o.tranches };
      for (const [cle, t] of Object.entries(o.tranches)) {
        const scenes = Array.from({ length: etat.rafale }, (_, i) => ({ ...t.scenes[0]!, id: `t${i + 1}`, debutMs: i * 250, finMs: (i + 1) * 250 }));
        const transitions = Object.fromEntries(scenes.map((s) => [s.id, { entree: "flash-ivoire", sortie: "fondu" }]));
        sortie[cle] = { ...t, scenes, habillageCommun: { version: "habillage-1", pleinCadrePermis: false, transitions } } as PlanHabille;
      }
      return sortie;
    },
  };
});

function grandGroupe(id: string): GroupePourPlan {
  const phrases = DIX_SCRIPTS.flatMap((s) => s.match(/[^.?!]+[.?!]?/g)!.map((p) => p.trim()).filter(Boolean)).slice(0, 30);
  let t = 0;
  return {
    id,
    ecrans: phrases.map((texteDit, i) => {
      const debutMs = t;
      t += texteDit.split(/\s+/).length * 350;
      return { id: `e${i + 1}`, texteDit, debutMs, finMs: t };
    }),
  };
}
const GROUPE = grandGroupe("corps");
const flashs = (r: { remarques: { code: string; message: string }[] }) => r.remarques.filter((x) => x.code === "FLASH");

type Scene = { id: string; debutMs: number; finMs: number; transition: { entree: string; sortie: string; dureeMs: number } };
const habille = (scenes: Scene[], transitions?: Record<string, { entree?: string; sortie?: string }>) =>
  ({ dureeMs: 5000, scenes, ...(transitions ? { habillageCommun: { version: "habillage-1", pleinCadrePermis: false, transitions } } : {}) }) as unknown as PlanHabille;
const scene = (id: string, debutMs: number, finMs: number): Scene => ({ id, debutMs, finMs, transition: { entree: "fondu", sortie: "fondu", dureeMs: 200 } });

beforeEach(() => {
  etat.rafale = 0;
});

describe("mesurerFlashs lit habillageCommun", () => {
  it("la constante est allumée (décision du 21/11)", () => {
    expect(FLASH_MESURE_ACTIVE).toBe(true);
  });
  it("plan sans habillageCommun : identique à avant (aucun flash)", () => {
    const m = mesurerFlashs(habille([scene("t1", 0, 250), scene("t2", 250, 500)]));
    expect(m).toEqual({ flashs: 0, maxParSeconde: 0, debutFenetreMs: 0, reserves: [] });
  });
  it("4 entrées en flash-ivoire en 1 s : réserve ; sortie = fin − durée", () => {
    const scenes = [0, 1, 2, 3].map((i) => scene(`t${i + 1}`, i * 250, (i + 1) * 250));
    const m = mesurerFlashs(habille(scenes, Object.fromEntries(scenes.map((s) => [s.id, { entree: "flash-ivoire" }]))));
    expect(m.flashs).toBe(4);
    expect(m.reserves[0]).toMatch(/^À vérifier : 4 flashs en 1 s/);
    const sortie = mesurerFlashs(habille([scene("t1", 0, 1000)], { t1: { sortie: "reflet-entree" } }));
    expect(sortie.flashs).toBe(1);
    expect(sortie.debutFenetreMs).toBe(800);
  });
  it("transitions de l'habillage sans lumière, ou pour une scène inconnue : zéro flash", () => {
    expect(mesurerFlashs(habille([scene("t1", 0, 500)], { t1: { entree: "poussee", sortie: "iris" } })).flashs).toBe(0);
    expect(mesurerFlashs(habille([scene("t1", 0, 500)], { zz: { entree: "flash-ivoire" } })).flashs).toBe(0);
  });
});

describe("planScenesCasConcret : remarque FLASH", () => {
  it("tranche habillée à 4 flashs en 1 s : une remarque FLASH en fin de liste, mémo et tranches inchangés", async () => {
    const base = await planScenesCasConcret({ groupes: [GROUPE], habillage: { actif: true, graine: "v-flash" } });
    expect(flashs(base)).toHaveLength(0);
    etat.rafale = 4;
    const r = await planScenesCasConcret({ groupes: [GROUPE], habillage: { actif: true, graine: "v-flash" } });
    const f = flashs(r);
    expect(f.length).toBeGreaterThan(0);
    expect(f[0]!.message).toMatch(/^À vérifier : 4 flashs en 1 s/);
    expect(r.remarques.slice(-f.length).every((x) => x.code === "FLASH")).toBe(true);
    expect(r.remarques.slice(0, base.remarques.length)).toEqual(base.remarques);
    expect(r.memo).toEqual(base.memo);
    expect(JSON.stringify(r.memo)).not.toContain("FLASH");
    expect(Object.keys(r.tranches).sort()).toEqual(Object.keys(base.tranches).sort());
    // Reprise depuis le mémo : la remarque n'est pas doublée.
    const rejoue = await planScenesCasConcret({ groupes: [GROUPE], memo: r.memo, habillage: { actif: true, graine: "v-flash" } });
    expect(flashs(rejoue)).toHaveLength(f.length);
  });
  it("3 flashs en 1 s : aucune remarque", async () => {
    etat.rafale = 3;
    const r = await planScenesCasConcret({ groupes: [GROUPE], habillage: { actif: true, graine: "v-flash" } });
    expect(flashs(r)).toHaveLength(0);
  });
  it("habillage absent ou `actif` ≠ true : remarques identiques à avant", async () => {
    etat.rafale = 4;
    const base = await planScenesCasConcret({ groupes: [GROUPE] });
    for (const actif of [false, "true" as never, 1 as never]) {
      const r = await planScenesCasConcret({ groupes: [GROUPE], habillage: { actif, graine: "v-flash" } });
      expect(flashs(r)).toHaveLength(0);
      expect(r.remarques).toEqual(base.remarques);
    }
    expect(flashs(base)).toHaveLength(0);
  });
});

describe("invariant : le plafond par défaut ne produit jamais de flash en rafale", () => {
  it("20 graines × DIX_SCRIPTS (≥ 10 écrans) : aucune remarque FLASH", async () => {
    const groupe = (id: string, script: string): GroupePourPlan => {
      const phrases = script.match(/[^.?!]+[.?!]?/g)!.map((p) => p.trim()).filter(Boolean);
      let t = 0;
      return { id, ecrans: phrases.map((texteDit, i) => { const debutMs = t; t += texteDit.split(/\s+/).length * 350; return { id: `e${i + 1}`, texteDit, debutMs, finMs: t }; }) };
    };
    const groupes = [GROUPE, ...DIX_SCRIPTS.map((s, i) => groupe(`s${i}`, s)).filter((g) => g.ecrans.length >= 10)];
    for (let g = 0; g < 20; g++) {
      const r = await planScenesCasConcret({ groupes, habillage: { actif: true, graine: `graine-${g}` } });
      expect(flashs(r)).toHaveLength(0);
      for (const gr of groupes) expect(cleTranche(gr.id, gr.ecrans[0]!.id)).toContain(gr.id);
    }
  });
});
