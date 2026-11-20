/** C11-T6b-c-v20i : prise floutée sous « Étape N » (fenêtres pures). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fondFlouSousEtape } from "@/briques/motion/titres-couverture/fond-etape";
import { ENTREE_S, SORTIE_S, TENUE_S } from "@/briques/motion/titres-couverture/etapes";

describe("fondFlouSousEtape", () => {
  it("a) une seule fenêtre exacte, valeurs par défaut de la carte, cible décor", () => {
    expect(ENTREE_S + TENUE_S + SORTIE_S).toBeCloseTo(2.5, 10);
    const f = fondFlouSousEtape(2);
    expect(f).toHaveLength(1);
    expect(f[0].debutSec).toBe(2);
    expect(f[0].finSec).toBeCloseTo(4.5, 10);
    expect(f[0].flouPx).toBe(12);
    expect(f[0].assombrir).toBe(0.35);
    expect(f[0].fonduSec).toBe(0.3);
    expect(f[0].cible).toBe("decor");
  });
  it("b) decorSepare false : aucune fenêtre", () => {
    expect(fondFlouSousEtape(2, { decorSepare: false })).toEqual([]);
  });
  it("c) début non fini ou négatif : aucune fenêtre", () => {
    expect(fondFlouSousEtape(Number.NaN)).toEqual([]);
    expect(fondFlouSousEtape(-1)).toEqual([]);
    expect(fondFlouSousEtape(Number.POSITIVE_INFINITY)).toEqual([]);
  });
  it("d) options bornées comme fond-flou-carte", () => {
    const f = fondFlouSousEtape(0, { flouPx: 99, assombrir: 5, fonduSec: 9 })[0];
    expect(f.flouPx).toBe(24);
    expect(f.assombrir).toBe(0.6);
    expect(f.fonduSec).toBe(0.4);
    const g = fondFlouSousEtape(0, { flouPx: -3, assombrir: -1, fonduSec: 0 })[0];
    expect(g.flouPx).toBe(0);
    expect(g.assombrir).toBe(0);
    expect(g.fonduSec).toBe(0.2);
  });
  it("e) l'entrée n'est pas modifiée et deux appels donnent le même résultat", () => {
    const o = { flouPx: 8 };
    const copie = { ...o };
    expect(fondFlouSousEtape(1, o)).toEqual(fondFlouSousEtape(1, o));
    expect(o).toEqual(copie);
  });
  it("f) garde statique : ni React, ni Remotion, ni @/", () => {
    const src = readFileSync("src/briques/motion/titres-couverture/fond-etape.ts", "utf8");
    expect(src).not.toMatch(/from\s+["'](react|remotion)/);
    expect(src).not.toMatch(/from\s+["']@\//);
    expect(src).not.toMatch(/require\(/);
    expect(src).toContain("jamais de flou sur la personne");
  });
});
