import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { choisirExtrait, type CandidatNote } from "@/briques/bibliotheque-video/pioche-extraits";
import { cleUsageExtrait, type IdCapacite } from "@/briques/bibliotheque-video/types";
import { rangGraine } from "@/briques/bibliotheque-video/graine";

const cap = "motion.extrait" as IdCapacite;
const ex = (n: string, o: Partial<CandidatNote> = {}): CandidatNote => ({
  id: n, capacite: cap, cle: cleUsageExtrait(n, "p1"), elementId: n, plageId: "p1",
  debutSec: 0, finSec: 5, ratio: "9:16", visage: "aucun", texteIncruste: false, famille: [],
  usages: ["ecran"], note: 50, sujet: null, ...o,
});
const besoin = { usage: "ecran" as const, sujet: null, graine: "g" };

describe("choisirExtrait (X4-14a)", () => {
  it("usage absent → null, liste vide → null", () => {
    expect(choisirExtrait([ex("a", { usages: ["fond"] }), ex("b", { usages: undefined })], besoin, [])).toBeNull();
    expect(choisirExtrait([], besoin, [])).toBeNull();
  });
  it("sujet identique gagne à note égale", () => {
    const r = choisirExtrait([ex("a", { sujet: "appels-offres" }), ex("b", { sujet: "factures" as never })], { ...besoin, sujet: "appels-offres" }, []);
    expect(r?.id).toBe("a");
  });
  it("la note pèse (note / 2)", () => {
    expect(choisirExtrait([ex("a", { note: 40 }), ex("b", { note: 80 })], besoin, [])?.id).toBe("b");
  });
  it("à score égal, le plus ancien d'abord", () => {
    expect(choisirExtrait([ex("a", { ancienneteJours: 3 }), ex("b", { ancienneteJours: 30 })], besoin, [])?.id).toBe("b");
  });
  it("départage par graine : stable, et suit rangGraine", () => {
    const c = [ex("a"), ex("b"), ex("c")];
    const r1 = choisirExtrait(c, besoin, []), r2 = choisirExtrait(c, besoin, []);
    expect(r1).toEqual(r2);
    for (const g of ["g1", "g2", "g3"]) {
      const attendu = [...c].sort((x, y) => rangGraine(g, x.cle).localeCompare(rangGraine(g, y.cle)))[0];
      expect(choisirExtrait(c, { ...besoin, graine: g }, [])?.id).toBe(attendu.id);
    }
  });
  it("dejaUtilisees jamais renvoyé", () => {
    const c = [ex("a", { note: 99 }), ex("b", { note: 10 })];
    expect(choisirExtrait(c, besoin, [c[0].cle])?.id).toBe("b");
    expect(choisirExtrait(c, besoin, [c[0].cle, c[1].cle])).toBeNull();
  });
  it("sans note après tous les notés", () => {
    const c = [ex("a", { note: undefined, sujet: "appels-offres" }), ex("b", { note: 0 })];
    expect(choisirExtrait(c, { ...besoin, sujet: "appels-offres" }, [])?.id).toBe("b");
    expect(choisirExtrait([c[0]], besoin, [])?.id).toBe("a");
  });
  it("entrée non modifiée", () => {
    const c = [ex("a"), ex("b", { note: 90 })];
    const copie = JSON.parse(JSON.stringify(c));
    const d = ["x"];
    choisirExtrait(c, besoin, d);
    expect(c).toEqual(copie);
    expect(d).toEqual(["x"]);
  });
  it("fichier pur : ni services, ni studio-rendu, ni argent, ni server-only", () => {
    const src = readFileSync(join(process.cwd(), "src/briques/bibliotheque-video/pioche-extraits.ts"), "utf8");
    const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    for (const i of imports) expect(i).not.toMatch(/@\/services\/|studio-rendu|credits|budget|couts|server-only|vitest/);
    expect(src).not.toMatch(/Math\.random|Date\.now|new Date/);
  });
  it("non exporté par l'index de la bibliothèque", () => {
    expect(readFileSync(join(process.cwd(), "src/briques/bibliotheque-video/index.ts"), "utf8")).not.toMatch(/pioche-extraits/);
  });
});
