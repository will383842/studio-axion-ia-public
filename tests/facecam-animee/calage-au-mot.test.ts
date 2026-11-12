import { describe, expect, it } from "vitest";
import { schemaElementV4, schemaPlanFacecamAnimee, type PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { recalerPlanAuMotV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { controlerDiversiteV4 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";

const mots = [
  { w: "bonjour", a: 1, f: 1.4 },
  { w: "agenda", a: 12.2, f: 12.6 },
  { w: "mail", a: 20, f: 20.3 },
  { w: "photo", a: 21, f: 21.3 },
];

function plan(elements: Array<Record<string, unknown>>): PlanFacecamAnimee {
  return { duree: 40, elementsV4: elements } as unknown as PlanFacecamAnimee;
}
const el = (debut: number, fin: number, extra: Record<string, unknown> = {}) => ({ id: "x", debut, fin, ...extra });

describe("GV-MD-03 : calage des animations sur le mot", () => {
  it("élément demandé à 12,6 s, mot à 12,2 s → début à 12,05 s (durée conservée)", () => {
    const r = recalerPlanAuMotV4(plan([el(12.6, 15.6)]), mots);
    expect(r.elementsV4![0].debut).toBeCloseTo(12.05, 5);
    expect(r.elementsV4![0].fin).toBeCloseTo(15.05, 5);
  });

  it("avec motIndex : début = début du mot − 0,15 s, même hors fenêtre de 0,8 s", () => {
    const r = recalerPlanAuMotV4(plan([el(10, 13, { motIndex: 1 })]), mots);
    expect(r.elementsV4![0].debut).toBeCloseTo(12.05, 5);
  });

  it("aucun mot à moins de 0,8 s → inchangé", () => {
    const p = plan([el(16, 18)]);
    expect(recalerPlanAuMotV4(p, mots).elementsV4![0]).toEqual(p.elementsV4![0]);
  });

  it("deux éléments qui se recouvriraient → le second garde sa place d'origine", () => {
    // 1er : 20,2 → 19,85 (fin 20,65) ; 2e : 21,2 voudrait aussi 19,85 et recouvrirait le 1er
    const r = recalerPlanAuMotV4(plan([el(20.2, 21, { motIndex: 2 }), el(21.2, 24, { motIndex: 2 })]), mots);
    const [a, b] = r.elementsV4!;
    expect(a.debut).toBeCloseTo(19.85, 5);
    expect(b.debut).toBeCloseTo(21.2, 5);
    expect(b.debut).toBeGreaterThanOrEqual(a.fin);
  });

  it("n'écrase pas le plan reçu et ne bouge pas une ligne datée hors de l'élément", () => {
    const p = plan([el(12.6, 15.6, { lignes: [{ texte: "a", a: 15.5 }] })]);
    const avant = JSON.stringify(p);
    const r = recalerPlanAuMotV4(p, mots);
    expect(JSON.stringify(p)).toBe(avant);
    expect(r.elementsV4![0].debut).toBeCloseTo(12.6, 5);
  });

  it("plan ancien sans motIndex : toujours valide au schéma", () => {
    expect(schemaElementV4.safeParse({ id: "x", debut: 1, fin: 3 }).success).toBe(true);
    expect(schemaElementV4.safeParse({ id: "x", debut: 1, fin: 3, motIndex: 4 }).success).toBe(true);
    expect(schemaElementV4.safeParse({ id: "x", debut: 1, fin: 3, motIndex: -1 }).success).toBe(false);
    expect(schemaPlanFacecamAnimee.shape.elementsV4).toBeDefined();
  });

  it("l'écart restant après recalage est une remarque, jamais une erreur (D15k)", () => {
    const p = { ...plan([el(10, 13, { motIndex: 1 })]), groupes: [], zooms: [], cartes: [], fenetres: [], calques: [], fin: { debut: 39 } } as unknown as PlanFacecamAnimee;
    const r = controlerDiversiteV4(p, { mots });
    expect(r.avertissements.some((m) => m.startsWith("D15k"))).toBe(true);
    expect(r.erreurs.some((m) => m.startsWith("D15k"))).toBe(false);
    const cale = controlerDiversiteV4(recalerPlanAuMotV4(p, mots), { mots });
    expect(cale.avertissements.some((m) => m.startsWith("D15k"))).toBe(false);
  });
});
