/** BR-FA-PLAN-FILTRE-a · filtre pur : aucune pièce du plan de scènes pendant une plaquette v4 (rien branché). */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { intervallesV4, retirerPiecesSousV4 } from "@/briques/plan-scenes-generateurs/filtre-v4";
import type { PlanValide, SceneValide } from "@/briques/plan-scenes/schema";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";

// Fixture réelle : la répétition générale (plan du réalisateur v4), la même que tests/facecam-animee/telephone-chaine-bout-en-bout.test.ts.
const PLAN_V4 = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "docs/facecam-animee-v4/repetition-generale/plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;

const scene = (id: string, debutMs: number, finMs: number) => ({ id, debutMs, finMs, empreinte: `emp-${id}` }) as unknown as SceneValide;
const planDe = (scenes: SceneValide[]) => ({ version: "x", facecam: true, dureeMs: 60_000, scenes }) as unknown as PlanValide;

describe("intervallesV4", () => {
  it("(b) un intervalle par élément du VRAI plan v4, en millisecondes", () => {
    const elements = PLAN_V4.elementsV4 ?? [];
    expect(elements.length).toBeGreaterThan(0);
    const r = intervallesV4(PLAN_V4);
    expect(r).toHaveLength(elements.length);
    elements.forEach((e, i) => {
      expect(r[i]).toEqual({ debutMs: Math.round(e.debut * 1000), finMs: Math.round(e.fin * 1000) });
      expect(r[i].finMs).toBeGreaterThan(r[i].debutMs);
    });
  });
  it("plan sans élément v4 ou absurde : liste vide, jamais d'exception", () => {
    expect(intervallesV4({ ...PLAN_V4, elementsV4: undefined })).toEqual([]);
    expect(intervallesV4(null as never)).toEqual([]);
    expect(intervallesV4({ elementsV4: [{ debut: Number.NaN, fin: 3 }] } as never)).toEqual([]);
  });
});

describe("retirerPiecesSousV4", () => {
  const plaquette = [{ debutMs: 10_000, finMs: 12_500 }];
  it("(c) la scène qui chevauche une plaquette (à 100 ms près) est retirée, les autres gardent ordre et empreintes", () => {
    const a = scene("a", 1_000, 3_000);
    const b = scene("b", 12_600, 14_000); // 100 ms après la fin : dans la marge de 200 ms
    const c = scene("c", 20_000, 22_000);
    const r = retirerPiecesSousV4(planDe([a, b, c]), plaquette);
    expect(r.scenes.map((s) => s.id)).toEqual(["a", "c"]);
    expect(r.scenes.map((s) => s.empreinte)).toEqual(["emp-a", "emp-c"]);
    expect(r.scenes[0]).toBe(a);
  });
  it("(c) aucune ne chevauche : plan identique, même tableau de scènes", () => {
    const p = planDe([scene("a", 1_000, 3_000), scene("c", 20_000, 22_000)]);
    const r = retirerPiecesSousV4(p, plaquette);
    expect(r).toEqual(p);
    expect(r.scenes).toBe(p.scenes);
  });
  it("une scène qui commence pile à la fin de la plaquette + marge est gardée ; marge 0 respectée", () => {
    const p = planDe([scene("a", 12_700, 14_000)]);
    expect(retirerPiecesSousV4(p, plaquette).scenes).toHaveLength(1);
    expect(retirerPiecesSousV4(planDe([scene("b", 12_600, 14_000)]), plaquette, 0).scenes).toHaveLength(1);
  });
  it("plus aucune scène restante : scenes vide", () => {
    expect(retirerPiecesSousV4(planDe([scene("a", 9_000, 11_000)]), plaquette).scenes).toEqual([]);
  });
  it("(d) entrées absurdes : jamais d'exception, plan inchangé", () => {
    const p = planDe([scene("a", 9_000, 11_000)]);
    expect(retirerPiecesSousV4(p, [])).toBe(p);
    expect(retirerPiecesSousV4(p, [{ debutMs: Number.NaN, finMs: 5 }])).toBe(p);
    expect(retirerPiecesSousV4(p, [{ debutMs: 12_000, finMs: 10_000 }])).toBe(p);
    expect(retirerPiecesSousV4(p, plaquette, Number.NaN).scenes).toEqual([]); // marge absurde : marge par défaut
    expect(() => retirerPiecesSousV4(null as never, plaquette)).not.toThrow();
    expect(() => retirerPiecesSousV4(p, null as never)).not.toThrow();
    expect(retirerPiecesSousV4(p, [{ debutMs: Infinity, finMs: Infinity }])).toBe(p);
  });
});
