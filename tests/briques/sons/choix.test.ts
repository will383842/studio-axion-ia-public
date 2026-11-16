import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { choisirSon, controlerDiversiteSons } from "../../../src/briques/sons/choix";
import { SONS } from "../../../src/briques/sons/registre";
import type { EntreeSon } from "../../../src/briques/sons/types";

const son = (id: string, famille: string, ecoute: EntreeSon["ecoute"]): EntreeSon => ({
  id, banque: "studio", chemin: `${id}.wav`, famille, dureeSec: 0.1, droitId: "d", ecoute, posablePar: ["*"],
});

describe("choisirSon", () => {
  it("sur le registre réel : sans validesEnBase, seuls les valide-par-decision sortent", () => {
    const fams = new Set(SONS.map((s) => s.famille));
    for (const f of fams) {
      const r = choisirSon(f, SONS, { graine: 3 });
      if (r) { expect(r.ecoute).toBe("valide-par-decision"); expect(r.famille).toBe(f); }
    }
    expect(choisirSon("chiffre", SONS, { graine: 3 })).toBeNull();
  });
  it("un son porté en base n'est admis que s'il est dans validesEnBase", () => {
    const l = [son("a", "x", "porte-en-base"), son("b", "x", "porte-en-base")];
    expect(choisirSon("x", l, { graine: 1, validesEnBase: new Set() })).toBeNull();
    expect(choisirSon("x", l, { graine: 1, validesEnBase: new Set(["b"]) })?.id).toBe("b");
  });
  it("aucun admis ou famille absente : null", () => {
    expect(choisirSon("absente", SONS, { graine: 1 })).toBeNull();
    expect(choisirSon("x", [], { graine: 1 })).toBeNull();
  });
  it("pas de répétition consécutive sur 200 graines (famille ≥ 2 sons)", () => {
    const l = [son("a", "x", "valide-par-decision"), son("b", "x", "valide-par-decision"), son("c", "x", "valide-par-decision")];
    for (let g = 1; g <= 200; g++) {
      for (const dernier of ["a", "b", "c"]) {
        const r = choisirSon("x", l, { graine: g, dejaPoses: ["z", dernier] });
        expect(r).not.toBeNull();
        expect(r!.id).not.toBe(dernier);
      }
    }
  });
  it("un seul candidat : il sort même s'il est le dernier posé", () => {
    const l = [son("a", "x", "valide-par-decision")];
    expect(choisirSon("x", l, { graine: 1, dejaPoses: ["a"] })?.id).toBe("a");
  });
  it("même graine = même son", () => {
    const l = [son("a", "x", "valide-par-decision"), son("b", "x", "valide-par-decision"), son("c", "x", "valide-par-decision")];
    for (let g = 1; g <= 50; g++) expect(choisirSon("x", l, { graine: g })?.id).toBe(choisirSon("x", l, { graine: g })?.id);
  });
  it("ne mute pas ses entrées", () => {
    const l = [son("a", "x", "valide-par-decision"), son("b", "x", "valide-par-decision")];
    const copie = JSON.stringify(l);
    choisirSon("x", l, { graine: 5, dejaPoses: ["a"] });
    expect(JSON.stringify(l)).toBe(copie);
  });
});

describe("controlerDiversiteSons", () => {
  const p = (id: string, famille: string, debutSec: number, fort?: boolean) => ({ id, famille, debutSec, fort });
  it("cas ok", () => {
    const r = controlerDiversiteSons([p("a1", "a", 1), p("b1", "b", 12), p("c1", "c", 25), p("d1", "d", 40), p("e1", "e", 50)], 60);
    expect(r).toEqual({ ok: true, motifs: [] });
  });
  it("aucune pose : ok", () => {
    expect(controlerDiversiteSons([], 30).ok).toBe(true);
  });
  it("(a) une famille au-delà de 30 % est refusée", () => {
    const r = controlerDiversiteSons([p("a1", "a", 1), p("a2", "a", 15), p("b1", "b", 30)], 60);
    expect(r.ok).toBe(false);
    expect(r.motifs.join(" ")).toMatch(/famille « a »/);
  });
  it("(b) deux sons forts dans la même tranche de 10 s", () => {
    const r = controlerDiversiteSons([p("a1", "a", 1, true), p("b1", "b", 5, true)], 60);
    expect(r.ok).toBe(false);
    expect(r.motifs.join(" ")).toMatch(/fort/);
    expect(controlerDiversiteSons([p("a1", "a", 1, true), p("b1", "b", 11, true), p("c1", "c", 25), p("d1", "d", 40)], 60).ok).toBe(true);
  });
  it("(c) aucun dans la dernière seconde", () => {
    const r = controlerDiversiteSons([p("a1", "a", 20), p("b1", "b", 29.5), p("c1", "c", 5), p("d1", "d", 10)], 30);
    expect(r.ok).toBe(false);
    expect(r.motifs.join(" ")).toMatch(/dernière seconde/);
  });
  it("(d) jamais deux fois le même fichier de suite", () => {
    const r = controlerDiversiteSons([p("a1", "a", 1), p("a1", "a", 20), p("b1", "b", 30), p("c1", "c", 40)], 60);
    expect(r.ok).toBe(false);
    expect(r.motifs.join(" ")).toMatch(/même fichier/);
  });
  it("l'ordre des poses fournies ne compte pas", () => {
    const r = controlerDiversiteSons([p("a1", "a", 20), p("a1", "a", 1), p("b1", "b", 30)], 60);
    expect(r.ok).toBe(false);
  });
});

describe("gardes de source", () => {
  const dir = new URL("../../../src/briques/sons/", import.meta.url);
  for (const f of ["choix.ts", "politique.ts"]) {
    it(`${f} : sans @/, Math.random, Date.now ; entête « Aucun consommateur »`, () => {
      const s = readFileSync(new URL(f, dir), "utf8");
      expect(s).not.toMatch(/from\s+["']@\//);
      expect(s).not.toContain("Math.random");
      expect(s).not.toContain("Date.now");
      expect(s).toContain("Aucun consommateur (C6-H14)");
    });
  }
  it("aucun fichier de studio-rendu/ n'importe briques/sons", () => {
    const racine = new URL("../../../studio-rendu/", import.meta.url).pathname;
    const trouves: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        if (n === "node_modules") continue;
        const c = join(d, n);
        if (statSync(c).isDirectory()) parcourir(c);
        else if (/\.(ts|tsx|js|mjs)$/.test(n) && readFileSync(c, "utf8").includes("briques/sons")) trouves.push(c);
      }
    };
    parcourir(racine);
    expect(trouves).toEqual([]);
  });
});
