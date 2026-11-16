/** G3-02 — passages de mise en page : absent = moitié/moitié actuel (identique sur les 4 ratios), passages mal formés ignorés. */
import { describe, expect, it } from "vitest";
import { miseEnPageA, miseEnPageDemo, normaliserPassages, TAILLES_DEMO, type PassageDemo, type RatioDemo } from "@/moteurs/montage-demo-facecam/mise-en-page";
import type { ProprietesDemoFacecam } from "@/moteurs/montage-demo-facecam/proprietes";

const RATIOS = Object.keys(TAILLES_DEMO) as RatioDemo[];

describe("passages : éteint = identique", () => {
  it.each(RATIOS)("sans passage, %s reste la moitié / moitié actuelle", (r) => {
    expect(miseEnPageA(r, undefined, 1000)).toEqual(miseEnPageDemo(r));
    expect(miseEnPageA(r, [], 1000)).toEqual(miseEnPageDemo(r));
  });
  it.each(RATIOS)("hors de tout passage, %s est inchangé", (r) => {
    expect(miseEnPageA(r, [{ debutMs: 2000, finMs: 3000, disposition: "ecran-plein" }], 1999)).toEqual(miseEnPageDemo(r));
    expect(miseEnPageA(r, [{ debutMs: 2000, finMs: 3000, disposition: "ecran-plein" }], 3000)).toEqual(miseEnPageDemo(r));
  });
  it("le champ est facultatif dans les propriétés", () => {
    const p: Pick<ProprietesDemoFacecam, "passages"> = {};
    expect(p.passages).toBeUndefined();
  });
});

describe("passages : actifs", () => {
  it.each(RATIOS)("écran plein occupe toute la toile (%s), sous-titres dans l'écran", (r) => {
    const m = miseEnPageA(r, [{ debutMs: 0, finMs: 1000, disposition: "ecran-plein" }], 500);
    const { largeur, hauteur } = TAILLES_DEMO[r];
    expect(m.ecran).toEqual({ x: 0, y: 0, largeur, hauteur });
    expect(m.facecam.largeur * m.facecam.hauteur).toBe(0);
    expect(m.sousTitres.y + m.sousTitres.hauteur).toBeLessThanOrEqual(hauteur);
  });
  it.each(RATIOS)("facecam plein occupe toute la toile (%s), rien d'autre sur le visage", (r) => {
    const m = miseEnPageA(r, [{ debutMs: 0, finMs: 1000, disposition: "facecam-plein" }], 0);
    const { largeur, hauteur } = TAILLES_DEMO[r];
    expect(m.facecam).toEqual({ x: 0, y: 0, largeur, hauteur });
    expect(m.ecran.largeur * m.ecran.hauteur).toBe(0);
    expect(m.sousTitres.largeur * m.sousTitres.hauteur).toBe(0);
  });
  it("une disposition « moitie » explicite redonne l'actuel", () => {
    expect(miseEnPageA("4:5", [{ debutMs: 0, finMs: 1000, disposition: "moitie" }], 10)).toEqual(miseEnPageDemo("4:5"));
  });
});

describe("normaliserPassages", () => {
  it("écarte le mal formé, trie, borne et supprime les chevauchements", () => {
    const brut = [
      null, 5, "x", {},
      { debutMs: 5000, finMs: 4000, disposition: "ecran-plein" },
      { debutMs: 3000, finMs: 4000, disposition: "inconnue" },
      { debutMs: Number.NaN, finMs: 4000, disposition: "ecran-plein" },
      { debutMs: 4000, finMs: 6000, disposition: "facecam-plein" },
      { debutMs: -500, finMs: 2000, disposition: "ecran-plein" },
      { debutMs: 1000, finMs: 5000, disposition: "ecran-plein" },
    ] as unknown as PassageDemo[];
    expect(normaliserPassages(brut)).toEqual([
      { debutMs: 0, finMs: 2000, disposition: "ecran-plein" },
      { debutMs: 4000, finMs: 6000, disposition: "facecam-plein" },
    ]);
  });
  it("tolère un non-tableau", () => {
    expect(normaliserPassages(undefined)).toEqual([]);
    expect(normaliserPassages({} as never)).toEqual([]);
  });
});
