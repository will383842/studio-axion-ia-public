import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHOIX_CARTES_ACTIF,
  choisirGroupesCarte,
  type EntreeChoixCartes,
  type SegmentCarte,
} from "@/briques/sous-titres/choix-cartes";
import type { FondCarte } from "@/briques/sous-titres/mode-carte";

const seg = (id: string, debutSec: number, finSec: number, mots: string[], style = "impact"): SegmentCarte => ({
  id,
  debutSec,
  finSec,
  style,
  mots: mots.map((mot) => ({ mot })),
});
const SANS_VISAGE = [{ debutSec: 0, finSec: 100 }];
const entree = (segments: SegmentCarte[], extra: Partial<EntreeChoixCartes> = {}): EntreeChoixCartes => ({
  segments,
  plansSansVisage: SANS_VISAGE,
  ...extra,
});

function figer<T>(o: T): T {
  if (o && typeof o === "object") {
    Object.values(o).forEach(figer);
    Object.freeze(o);
  }
  return o;
}

describe("choisirGroupesCarte (K2-T7-a)", () => {
  it("a) sobre (aucun Impact) → {}", () => {
    expect(choisirGroupesCarte(entree([seg("a", 1, 2, ["67", "clients"], "karaoke")]))).toEqual({});
  });

  it("b) chiffre → terracotta ; mot à plaque sans chiffre → noir", () => {
    expect(choisirGroupesCarte(entree([seg("a", 1, 2, ["67", "clients"])]))).toEqual({ a: "terracotta" });
    expect(choisirGroupesCarte(entree([seg("b", 1, 2, ["jamais", "seul"])]))).toEqual({ b: "noir" });
  });

  it("c) à cheval sur un plan avec visage (0,01 s) ou aucun plan sans visage → {}", () => {
    const s = seg("a", 10, 12, ["67", "clients"]);
    expect(choisirGroupesCarte(entree([s], { plansSansVisage: [{ debutSec: 5, finSec: 11.99 }] }))).toEqual({});
    expect(choisirGroupesCarte(entree([s], { plansSansVisage: [] }))).toEqual({});
    expect(choisirGroupesCarte(entree([s], { plansSansVisage: [{ debutSec: 10, finSec: 12 }] }))).toEqual({ a: "terracotta" });
  });

  it("d) sans signal fort → {} ; fait nombre/passage qui recoupe → carte ; groupe vide ou durée 0 ignorés", () => {
    const s = seg("a", 1, 2, ["bonjour", "madame"]);
    expect(choisirGroupesCarte(entree([s]))).toEqual({});
    expect(choisirGroupesCarte(entree([s], { faits: [{ type: "nombre", debutSec: 1.5, finSec: 3 }] }))).toEqual({ a: "noir" });
    expect(choisirGroupesCarte(entree([s], { faits: [{ type: "passage", debutSec: 0, finSec: 1.2 }] }))).toEqual({ a: "noir" });
    expect(choisirGroupesCarte(entree([s], { faits: [{ type: "citation", debutSec: 0, finSec: 3 }] }))).toEqual({});
    expect(choisirGroupesCarte(entree([s], { faits: [{ type: "nombre", debutSec: 2, finSec: 3 }] }))).toEqual({});
    expect(choisirGroupesCarte(entree([seg("v", 1, 2, [])]))).toEqual({});
    expect(choisirGroupesCarte(entree([seg("z", 1, 1, ["67"])]))).toEqual({});
  });

  it("e) maxCartes et écart entre cartes", () => {
    const trois = [seg("a", 1, 2, ["10"]), seg("b", 5, 6, ["20"]), seg("c", 20, 21, ["30"])];
    expect(choisirGroupesCarte(entree(trois, { maxCartes: 1 }))).toEqual({ a: "terracotta" });
    expect(choisirGroupesCarte(entree(trois))).toEqual({ a: "terracotta" });
    expect(Object.keys(choisirGroupesCarte(entree(trois, { maxCartes: 2, impactEcartSec: 6 })))).toEqual(["a", "c"]);
    expect(Object.keys(choisirGroupesCarte(entree(trois, { maxCartes: 2, impactEcartSec: 3 })))).toEqual(["a", "b"]);
  });

  it("f) pure : deux appels égaux, entrée non mutée, ordre d'entrée sans effet", () => {
    const trois = [seg("a", 1, 2, ["10"]), seg("b", 5, 6, ["20"]), seg("c", 20, 21, ["30"])];
    const e = figer(entree(trois, { maxCartes: 2, impactEcartSec: 6 }));
    expect(choisirGroupesCarte(e)).toEqual(choisirGroupesCarte(e));
    const melange = entree([trois[2], trois[0], trois[1]], { maxCartes: 2, impactEcartSec: 6 });
    expect(choisirGroupesCarte(melange)).toEqual(choisirGroupesCarte(e));
    const memeDebut = entree([seg("y", 1, 2, ["1"]), seg("x", 1, 2, ["2"])]);
    expect(Object.keys(choisirGroupesCarte(memeDebut))).toEqual(["x"]);
  });

  it("g) compatible avec FondCarte (type de mode-carte)", () => {
    const r = choisirGroupesCarte(entree([seg("a", 1, 2, ["67"])]));
    expect(Object.values(r) satisfies FondCarte[]).toEqual(["terracotta"]);
  });

  it("h) gardes de texte : pas d'import de mode-carte, aucun importeur, interrupteur éteint", () => {
    expect(CHOIX_CARTES_ACTIF).toBe(false);
    const src = readFileSync("src/briques/sous-titres/choix-cartes.ts", "utf8");
    expect(src).not.toMatch(/mode-carte/);
    const fichiers = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        if (n === "node_modules") return [];
        const p = join(d, n);
        return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    for (const racine of ["src", "studio-rendu/src", "studio-rendu/compositions"]) {
      for (const f of fichiers(racine)) {
        if (f.endsWith("choix-cartes.ts")) continue;
        expect(readFileSync(f, "utf8"), f).not.toMatch(/(?:from|import)\s*\(?\s*["'][^"']*choix-cartes["']/);
      }
    }
  });
});
