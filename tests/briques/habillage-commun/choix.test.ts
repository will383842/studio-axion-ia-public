import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { choisirTransitions } from "@/briques/motion/habillage-commun/choix";
import { IDS_TRANSITIONS_COMMUNES } from "@/briques/motion/habillage-commun/transitions";
import { PLAFONDS_PAR_DEFAUT, type PlafondsHabillage } from "@/briques/motion/habillage-commun/types";
import { POSITIONS, devantLeVisage } from "@/briques/plan-scenes/zones";
import { hasard } from "@/briques/motion/courbes";
import type { PlanValide } from "@/briques/plan-scenes/schema";

const SOURCE = readFileSync(join(__dirname, "../../../src/briques/motion/habillage-commun/choix.ts"), "utf8");

function plan(graine: number, facecam: boolean, n: number, dureeFixe?: number, position?: (typeof POSITIONS)[number]): PlanValide {
  let t = 0;
  const scenes = Array.from({ length: n }, (_, i) => {
    const d = dureeFixe ?? Math.round(400 + hasard(graine * 7 + i) * 5600);
    const s = {
      id: `s${i}`, debutMs: t, finMs: t + d,
      position: position ?? POSITIONS[Math.floor(hasard(graine * 13 + i) * POSITIONS.length)],
    };
    t += d;
    return s;
  });
  return { facecam, scenes } as unknown as PlanValide;
}

const aplat = (h: ReturnType<typeof choisirTransitions>) =>
  Object.entries(h.transitions ?? {}).sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)));
const ids = (h: ReturnType<typeof choisirTransitions>) => aplat(h).flatMap(([, v]) => [v.entree, v.sortie].filter(Boolean) as string[]);
const lot = (p: Partial<PlafondsHabillage> = {}, extra: { permettreAttenteMesure?: boolean } = {}) =>
  Array.from({ length: 200 }, (_, k) => {
    const g = k + 1;
    const pl = plan(g, g % 2 === 0, 1 + (g % 30));
    return { pl, h: choisirTransitions(pl, { plafonds: { ...PLAFONDS_PAR_DEFAUT, pleinCadrePermis: true, ...p }, graine: g, ...extra }) };
  });

describe("choix des transitions (C6-H2)", () => {
  it("200 plans : plafond, part de coupes franches, pas deux fois la même de suite, scène courte intacte", () => {
    for (const { pl, h } of lot()) {
      const enrichies = aplat(h);
      expect(enrichies.length).toBeLessThanOrEqual(PLAFONDS_PAR_DEFAUT.transitionsRichesMax);
      expect((pl.scenes.length - enrichies.length) / pl.scenes.length).toBeGreaterThanOrEqual(0.9 - 1e-9);
      const suite = ids(h);
      suite.forEach((id, i) => { if (i > 0) expect(id).not.toBe(suite[i - 1]); });
      for (const [id] of enrichies) {
        const s = pl.scenes.find((x) => x.id === id)!;
        expect(s.finMs - s.debutMs).toBeGreaterThanOrEqual(1200);
      }
    }
  });
  it("10 scènes : 1 au plus ; moins de 10 : aucune", () => {
    expect(aplat(choisirTransitions(plan(1, false, 10, 3000), { plafonds: PLAFONDS_PAR_DEFAUT, graine: 1 })).length).toBe(1);
    expect(aplat(choisirTransitions(plan(1, false, 9, 3000), { plafonds: PLAFONDS_PAR_DEFAUT, graine: 1 })).length).toBe(0);
    expect(aplat(choisirTransitions(plan(1, false, 30, 3000), { plafonds: PLAFONDS_PAR_DEFAUT, graine: 1 })).length).toBe(3);
  });
  it("même graine = même résultat ; graines différentes = résultats différents", () => {
    const a = lot(), b = lot();
    expect(a.map((x) => x.h)).toEqual(b.map((x) => x.h));
    const pl = plan(5, false, 30, 3000);
    const rs = new Set(Array.from({ length: 20 }, (_, g) => JSON.stringify(choisirTransitions(pl, { plafonds: PLAFONDS_PAR_DEFAUT, graine: g + 1 }))));
    expect(rs.size).toBeGreaterThan(1);
  });
  it("plein cadre jamais si non permis, ni en face caméra", () => {
    const plein = (id: string) => id === "volet-terracotta";
    for (const { pl, h } of lot({ pleinCadrePermis: false })) { expect(h.pleinCadrePermis).toBe(false); expect(ids(h).some(plein)).toBe(false); }
    for (const { pl, h } of lot({ pleinCadrePermis: true })) {
      expect(h.pleinCadrePermis).toBe(!pl.facecam);
      if (pl.facecam) expect(ids(h).some(plein)).toBe(false);
    }
    expect(lot({ pleinCadrePermis: true }).some(({ h }) => ids(h).some(plein))).toBe(true);
  });
  it("face caméra : aucune scène devant le visage n'a de transition (AM-02)", () => {
    let vu = 0;
    for (const { pl, h } of lot()) {
      if (!pl.facecam) continue;
      for (const [id] of aplat(h)) { vu++; expect(devantLeVisage(pl.scenes.find((s) => s.id === id)!.position)).toBe(false); }
    }
    expect(vu).toBeGreaterThan(0);
    for (const p of POSITIONS.filter(devantLeVisage)) {
      expect(choisirTransitions(plan(3, true, 30, 3000, p), { plafonds: PLAFONDS_PAR_DEFAUT, graine: 3 }).transitions).toBeUndefined();
    }
  });
  it("liste blanche ; glisse-flou* absents sans permettreAttenteMesure ; 4 historiques jamais posés", () => {
    const interdits = ["cube", "page", "mosaique", "glitch", "fondu", "glisse-haut", "glisse-gauche", "zoom-doux"];
    for (const { h } of lot()) for (const id of ids(h)) {
      expect(IDS_TRANSITIONS_COMMUNES as readonly string[]).toContain(id);
      expect(id.startsWith("glisse-flou")).toBe(false);
      expect(interdits).not.toContain(id);
    }
    expect(lot({}, { permettreAttenteMesure: true }).some(({ h }) => ids(h).some((i) => i.startsWith("glisse-flou")))).toBe(true);
  });
  it("historique : la plus fréquente est évitée", () => {
    const pl = plan(2, false, 30, 3000);
    for (let g = 1; g <= 50; g++) {
      const h = choisirTransitions(pl, { plafonds: PLAFONDS_PAR_DEFAUT, graine: g, historique: [["iris", "iris"], ["poussee"]] });
      expect(ids(h)).not.toContain("iris");
    }
  });
  it("plan vide ou plafond 0 : pas de transitions", () => {
    const vide = choisirTransitions({ facecam: false, scenes: [] } as unknown as PlanValide, { plafonds: PLAFONDS_PAR_DEFAUT, graine: 1 });
    expect(vide).toEqual({ version: "habillage-1", pleinCadrePermis: false });
    const zero = choisirTransitions(plan(1, false, 30, 3000), { plafonds: { ...PLAFONDS_PAR_DEFAUT, transitionsRichesMax: 0 }, graine: 1 });
    expect(zero.transitions).toBeUndefined();
  });
  it("source : aucun @/, Math.random, Date.now", () => {
    expect(SOURCE).not.toMatch(/@\/|Math\.random|Date\.now|new Date/);
  });
});
