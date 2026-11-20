import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { filtrerSelectif, SELECTIF_ACTIF } from "../../../src/briques/sous-titres/selectif";
import type { SegmentRendu } from "../../../src/briques/sous-titres/types-rendu";

const seg = (id: string, debutSec: number, finSec: number, ...mots: string[]): SegmentRendu => ({
  id,
  debutSec,
  finSec,
  mots: mots.map((mot, i) => ({ mot, debutSec: debutSec + i * 0.1, finSec: debutSec + (i + 1) * 0.1 })),
});
const groupes = [
  seg("a", 0, 1, "bonjour", "à", "tous"),
  seg("b", 1, 2.5, "environ", "30", "%", "de", "remise"),
  seg("c", 2.5, 4, "vous", "avez", "trois", "devis"),
  seg("d", 4, 5, "le", "devis", "arrive"),
];

describe("sous-titres sélectifs", () => {
  it("est éteint par défaut", () => expect(SELECTIF_ACTIF).toBe(false));
  it("éteint : sortie égale à l'entrée, copie", () => {
    const r = filtrerSelectif(groupes, ["devis"]);
    expect(JSON.stringify(r)).toBe(JSON.stringify(groupes));
    expect(r).not.toBe(groupes);
    expect(filtrerSelectif(groupes, ["devis"], false)).toEqual(groupes);
    expect(filtrerSelectif(groupes, ["devis"], undefined)).toEqual(groupes);
    expect(filtrerSelectif(groupes, ["devis"], "true" as unknown as boolean)).toEqual(groupes);
  });
  it("allumé : retire les groupes sans mot-clé ni nombre, minutage inchangé", () => {
    const r = filtrerSelectif(groupes, ["remise"], true);
    expect(r.map((g) => g.id)).toEqual(["a", "b", "c", "d"]);
    expect(r[0]!.mots).toEqual([]);
    expect(r[3]!.mots).toEqual([]);
    expect(r[1]).toEqual(groupes[1]);
    expect(r[2]).toEqual(groupes[2]);
    r.forEach((g, i) => {
      expect(g.debutSec).toBe(groupes[i]!.debutSec);
      expect(g.finSec).toBe(groupes[i]!.finSec);
    });
  });
  it("mot-clé gardé, insensible à la casse et aux accents", () => {
    const r = filtrerSelectif(groupes, ["DEVIS", "à"], true);
    expect(r.map((g) => g.mots.length > 0)).toEqual([true, true, true, true]);
    const s = filtrerSelectif([seg("x", 0, 1, "Écoutez", "bien")], ["ecoutez"], true);
    expect(s[0]!.mots.length).toBe(2);
  });
  it("liste vide : seuls les groupes avec un nombre restent", () => {
    const r = filtrerSelectif(groupes, [], true);
    expect(r.map((g) => g.mots.length > 0)).toEqual([false, true, true, false]);
  });
  it("reconnaît chiffres, décimaux, nombres en lettres", () => {
    const t = (...m: string[]) => filtrerSelectif([seg("x", 0, 1, ...m)], [], true)[0]!.mots.length > 0;
    expect(t("12,5")).toBe(true);
    expect(t("vingt-deux")).toBe(true);
    expect(t("cent", "euros")).toBe(true);
    expect(t("mille")).toBe(true);
    expect(t("une", "chance")).toBe(false);
    expect(t("bonjour")).toBe(false);
  });
  it("ponctuation collée : « trois. », « trois, », « 30 %, » gardés ; « devis. » reconnu comme mot-clé", () => {
    const t = (cles: string[], ...m: string[]) => filtrerSelectif([seg("x", 0, 1, ...m)], cles, true)[0]!.mots.length > 0;
    expect(t([], "trois.")).toBe(true);
    expect(t([], "trois,")).toBe(true);
    expect(t([], "30", "%,")).toBe(true);
    expect(t(["devis"], "Votre", "devis.")).toBe(true);
    expect(t(["devis."], "devis")).toBe(true);
    expect(t([], "bonjour.")).toBe(false);
  });
  it("n'altère pas l'entrée", () => {
    const copie = structuredClone(groupes);
    filtrerSelectif(groupes, [], true);
    expect(groupes).toEqual(copie);
  });
});

describe("garde : pièce non branchée", () => {
  const racine = join(__dirname, "../../../src");
  const sources = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
  it("aucun fichier existant n'importe selectif, hors selectif-calque.ts (K2-T2-b1)", () => {
    const importeurs = sources(racine).filter((p) => !p.endsWith("selectif.ts") && /from\s+["'][^"']*\/selectif["']/.test(readFileSync(p, "utf8")));
    expect(importeurs).toEqual([join(racine, "briques/composition/selectif-calque.ts")]);
  });
  it("aucun alias @/ dans selectif.ts", () => {
    expect(readFileSync(join(racine, "briques/sous-titres/selectif.ts"), "utf8")).not.toMatch(/from\s+["']@\//);
  });
});
