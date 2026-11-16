import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import * as provenance from "./provenance";
import { marquerAvisDuSite, vientDuSite } from "./provenance";
import type { AvisClient } from "./types";

function avis(o: Partial<AvisClient> = {}): AvisClient {
  return {
    id: "a1", auteur: "Marie", date: "2026-05-01", source: "google", note: 5,
    texte: "Très bien.", statut: "published",
    accordAuteur: { ecrit: true, date: "2026-05-02", forme: "courriel" },
    valideLe: "2026-05-03", ...o,
  };
}

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const p = join(dir, nom);
    if (nom === "node_modules") continue;
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.(ts|tsx)$/.test(nom)) out.push(p);
  }
  return out;
}

describe("provenance « lecteur du site » (N-12)", () => {
  it("un avis marqué vient du site", () => {
    expect(vientDuSite(marquerAvisDuSite(avis()))).toBe(true);
  });
  it("un avis écrit à la main (littéral) ne vient pas du site", () => {
    expect(vientDuSite(avis())).toBe(false);
    expect(vientDuSite(avis({ verifie: true }))).toBe(false);
  });
  it("une copie {...avis} d'un avis marqué n'a pas la marque", () => {
    expect(vientDuSite({ ...marquerAvisDuSite(avis()) })).toBe(false);
  });
  it("une copie JSON n'a pas la marque", () => {
    expect(vientDuSite(JSON.parse(JSON.stringify(marquerAvisDuSite(avis()))))).toBe(false);
  });
  it("marquer ne modifie pas l'avis d'origine et garde son contenu", () => {
    const a = avis();
    const m = marquerAvisDuSite(a);
    expect(vientDuSite(a)).toBe(false);
    expect(m).toEqual(a);
  });
  it("le symbole n'est pas exporté", () => {
    expect(Object.keys(provenance).sort()).toEqual(["marquerAvisDuSite", "vientDuSite"]);
  });
  it("seuls le lecteur du site et les tests importent marquerAvisDuSite", () => {
    const racine = join(__dirname, "..", "..");
    const fautifs = sources(racine)
      .filter((f) => !/\.test\.tsx?$/.test(f))
      .filter((f) => relative(racine, f) !== join("domaine", "avis-client", "provenance.ts"))
      .filter((f) => relative(racine, f) !== join("fournisseurs", "site", "avis.ts"))
      .filter((f) => readFileSync(f, "utf8").includes("marquerAvisDuSite"))
      .map((f) => relative(racine, f));
    expect(fautifs).toEqual([]);
  });
});
