import { describe, expect, it } from "vitest";
import { AXES_COMMUNS, type EmpreinteVideo, type Voisine } from "@/briques/variete-commune/types";
import { choisirCandidat } from "@/briques/variete-commune/tirage";

// Candidate « sel » : toutes les valeurs = ["v"+sel] ; la voisine porte les valeurs données.
const emp = (val: (a: string) => string): EmpreinteVideo => ({
  version: "empreinte/1", videoId: "v", formatId: "f", le: "2026-11-10T08:00:00.000Z",
  axes: Object.fromEntries(AXES_COMMUNS.map((a) => [a, [val(a)]])),
});
const voisines = (val: (a: string) => string): Voisine[] => [{ empreinte: emp(val), reseau: "TikTok", rang: 5 }];
const fabrique = (sel: number) => ({ sel });

describe("tirage semé avec repli (X2-04)", () => {
  it("1er candidat accepté → sel 0, pas de repli", () => {
    const r = choisirCandidat(fabrique, (c) => emp(() => "x" + c.sel), voisines(() => "autre"));
    expect(r.sel).toBe(0);
    expect(r.repli).toBe(false);
    expect(r.resultat.ok).toBe(true);
  });
  it("garde le premier accepté", () => {
    // sel 0..2 identiques à la voisine, sel 3 différent
    const r = choisirCandidat(fabrique, (c) => emp(() => (c.sel < 3 ? "m" : "n" + c.sel)), voisines(() => "m"));
    expect(r.sel).toBe(3);
    expect(r.repli).toBe(false);
  });
  it("tous refusés → repli = le moins ressemblant, repli: true, ne lève pas", () => {
    // sel 5 ne diffère que sur 2 axes (score ~0,73) ; les autres sont identiques → refus partout
    const r = choisirCandidat(
      fabrique,
      (c) => emp((a) => (c.sel === 5 && (a === "ouverture" || a === "palette") ? "z" : "m")),
      voisines(() => "m"),
    );
    expect(r.repli).toBe(true);
    expect(r.sel).toBe(5);
    expect(r.resultat.ok).toBe(false);
    expect(r.candidat).toEqual({ sel: 5 });
  });
  it("égalité de score au repli → plus petit sel", () => {
    const r = choisirCandidat(fabrique, () => emp(() => "m"), voisines(() => "m"), { essais: 4 });
    expect(r.repli).toBe(true);
    expect(r.sel).toBe(0);
  });
  it("essaie exactement 16 fois par défaut", () => {
    const vus: number[] = [];
    choisirCandidat((s) => (vus.push(s), { sel: s }), () => emp(() => "m"), voisines(() => "m"));
    expect(vus).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });
  it("déterministe : 10 appels égaux", () => {
    const go = () => choisirCandidat(fabrique, (c) => emp(() => (c.sel < 7 ? "m" : "n")), voisines(() => "m"));
    const p = go();
    for (let i = 0; i < 10; i++) expect(go()).toEqual(p);
  });
  it("graine facultative : change l'ordre d'essai, déterministe, même résultat qu'absente si la graine est absente", () => {
    const vus: number[] = [];
    const r1 = choisirCandidat((s) => (vus.push(s), { sel: s }), () => emp(() => "m"), voisines(() => "m"), { graine: "g" });
    expect(r1.repli).toBe(true);
    expect(r1.sel).toBe(0);
    const r2 = choisirCandidat(fabrique, () => emp(() => "m"), voisines(() => "m"), { graine: "g" });
    expect(r2).toEqual(r1);
    expect([...vus].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });
});
