/** C6-H4b · habillage commun des tranches du cas concret (pur, non branché). */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { graineHabillage, habillerTranches } from "@/moteurs/montage-cas-concret/habillage-plan";
import { choisirTransitions } from "@/briques/motion/habillage-commun/choix";
import { IDS_TRANSITIONS_COMMUNES } from "@/briques/motion/habillage-commun/transitions";
import { PLAFONDS_PAR_DEFAUT } from "@/briques/motion/habillage-commun/types";
import { tranchePlan } from "@/briques/plan-scenes-generateurs/tranche";
import type { PlanValide } from "@/briques/plan-scenes/schema";

const SOURCE = readFileSync(join(__dirname, "../../src/moteurs/montage-cas-concret/habillage-plan.ts"), "utf8");

function planDe(n: number, debuts?: number[]): PlanValide {
  const scenes = Array.from({ length: n }, (_, i) => {
    const d = debuts ? debuts[i] : i * 1500;
    const f = debuts ? debuts[i + 1] ?? d + 1500 : d + 1500;
    return { id: `s${i}`, debutMs: d, finMs: f, position: "haut", calques: [], mots: { premier: i, dernier: i } };
  });
  return {
    facecam: false, format: { largeur: 1080, hauteur: 1920, fps: 25 }, dureeMs: scenes[n - 1].finMs, mots: [], scenes,
  } as unknown as PlanValide;
}

const ECRANS = [0, 1, 2, 3].map((k) => ({ cle: `e${k}`, debutMs: k * 9000, finMs: (k + 1) * 9000 }));

function tranchesDe(plan: PlanValide, ecrans = ECRANS): Record<string, PlanValide> {
  const r: Record<string, PlanValide> = {};
  for (const e of ecrans) {
    const t = tranchePlan(plan, e.debutMs, e.finMs);
    if (t) r[e.cle] = t;
  }
  return r;
}

function gel<T>(o: T): T {
  if (o && typeof o === "object") for (const v of Object.values(o)) gel(v);
  return Object.freeze(o);
}

const plafonds = { ...PLAFONDS_PAR_DEFAUT };
const lancer = (plan: PlanValide, tranches: Record<string, PlanValide>, graine = 7, actif: boolean = true, ecrans = ECRANS) =>
  habillerTranches({ actif, plan, ecrans, tranches, plafonds, graine });
const posees = (r: Readonly<Record<string, PlanValide>>) =>
  Object.entries(r).flatMap(([c, t]) => {
    const h = (t as { habillageCommun?: { transitions: Record<string, { entree?: string; sortie?: string }> } }).habillageCommun;
    return h ? [[c, h] as const] : [];
  });

describe("habillerTranches (C6-H4b)", () => {
  it("éteint : même référence, 20 graines", () => {
    const plan = planDe(24);
    const tr = tranchesDe(plan);
    for (let g = 1; g <= 20; g++) {
      expect(lancer(plan, tr, g, false)).toBe(tr);
      expect(lancer(plan, tr, g, "true" as never)).toBe(tr);
      expect(habillerTranches({ actif: undefined as never, plan, ecrans: ECRANS, tranches: tr, plafonds, graine: g })).toBe(tr);
    }
  });

  it("allumé : au moins une tranche habillée, ids valides, clés de la tranche, total borné", () => {
    const plan = planDe(24);
    const tr = tranchesDe(plan);
    const h = choisirTransitions(plan, { plafonds, graine: 7 });
    const total = Object.keys(h.transitions ?? {}).length;
    expect(total).toBeGreaterThan(0);
    const r = lancer(plan, tr);
    const p = posees(r);
    expect(p.length).toBeGreaterThan(0);
    let n = 0;
    for (const [c, hab] of p) {
      const idsScenes = tr[c].scenes.map((s) => s.id);
      expect(hab.version).toBe("habillage-1");
      for (const [k, v] of Object.entries(hab.transitions)) {
        expect(idsScenes).toContain(k);
        for (const id of [v.entree, v.sortie].filter(Boolean) as string[]) expect(IDS_TRANSITIONS_COMMUNES as readonly string[]).toContain(id);
        n++;
      }
    }
    expect(n).toBeLessThanOrEqual(total);
    expect(Object.keys(r)).toEqual(Object.keys(tr));
  });

  it("correspondance avec le choix sur le plan entier ; tranches sans transition = même objet", () => {
    const plan = planDe(24);
    const tr = tranchesDe(plan);
    const h = choisirTransitions(plan, { plafonds, graine: 7 });
    const r = lancer(plan, tr);
    ECRANS.forEach((e, ei) => {
      const gardees = plan.scenes.filter((s) => s.finMs > e.debutMs && s.debutMs < e.finMs);
      const hab = (r[e.cle] as { habillageCommun?: { transitions: Record<string, unknown> } }).habillageCommun;
      gardees.forEach((s, k) => {
        expect(hab?.transitions[`t${k + 1}`]).toEqual(h.transitions?.[s.id]);
      });
      if (!hab) expect(r[e.cle]).toBe(tr[e.cle]);
      expect(ei).toBeGreaterThanOrEqual(0);
    });
  });

  it("scène à cheval sur deux écrans : rien", () => {
    // 6 scènes ; la scène s2 va de 7000 à 11000 et chevauche les écrans 0 et 1.
    const plan = planDe(12, [0, 3000, 7000, 11000, 12500, 14000, 15500, 17000, 18500, 20000, 21500, 23000]);
    const ecrans = [{ cle: "a", debutMs: 0, finMs: 9000 }, { cle: "b", debutMs: 9000, finMs: 24500 }];
    const tr = tranchesDe(plan, ecrans);
    for (let g = 1; g <= 30; g++) {
      const r = lancer(plan, tr, g, true, ecrans);
      const idxA = tr.a.scenes.findIndex((s) => s.debutMs === 7000);
      const idxB = tr.b.scenes.findIndex((s) => s.finMs === 2000);
      const ha = (r.a as { habillageCommun?: { transitions: Record<string, unknown> } }).habillageCommun;
      const hb = (r.b as { habillageCommun?: { transitions: Record<string, unknown> } }).habillageCommun;
      expect(idxA).toBeGreaterThanOrEqual(0);
      expect(idxB).toBeGreaterThanOrEqual(0);
      expect(ha?.transitions[`t${idxA + 1}`]).toBeUndefined();
      expect(hb?.transitions[`t${idxB + 1}`]).toBeUndefined();
    }
  });

  it("plan de 5 scènes : rien à poser", () => {
    const plan = planDe(5);
    const ecrans = [{ cle: "a", debutMs: 0, finMs: 7500 }];
    const tr = tranchesDe(plan, ecrans);
    for (let g = 1; g <= 10; g++) expect(lancer(plan, tr, g, true, ecrans)).toBe(tr);
  });

  it("déterminisme et graine", () => {
    const plan = planDe(24);
    const tr = tranchesDe(plan);
    expect(lancer(plan, tr)).toEqual(lancer(plan, tr));
    const g = graineHabillage("v1/g1");
    expect(g).toBe(graineHabillage("v1/g1"));
    expect(Number.isInteger(g)).toBe(true);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).not.toBe(graineHabillage("v1/g2"));
  });

  it("entrées gelées : aucune exception, aucune modification", () => {
    const plan = gel(planDe(24));
    const tr = gel(tranchesDe(planDe(24)));
    const ecrans = gel(ECRANS.map((e) => ({ ...e })));
    const avant = JSON.stringify([plan, tr, ecrans]);
    expect(() => lancer(plan, tr, 7, true, ecrans)).not.toThrow();
    expect(JSON.stringify([plan, tr, ecrans])).toBe(avant);
  });

  it("garde de source", () => {
    expect(SOURCE).not.toMatch(/@\/services\/|studio-rendu|habillage-commun\/reglage|Math\.random|Date\.now/);
  });
});
