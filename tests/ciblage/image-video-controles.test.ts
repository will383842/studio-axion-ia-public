/** Ciblage, lot F : remarque C100 (cible absente des 5 premières secondes), jamais bloquante. */
import { describe, expect, it } from "vitest";
import type { Ciblage } from "@/domaine/ciblage/types";
import { CODES_CONTROLE_IV, CONTROLES_INDICATIFS, LIBELLES_CONTROLE_IV, remarqueCibleIV } from "@/moteurs/montage-image-video/controles";
import { readFileSync } from "node:fs";

const metier: Ciblage = { niveau: "metier", libelle: "plombier", origine: "saisie" };

describe("remarqueCibleIV", () => {
  it("aucune cible déclarée : aucune remarque (jamais un blocage)", () => {
    expect(remarqueCibleIV("Bonjour à tous, voici une astuce.", undefined)).toEqual([]);
  });
  it("cible nommée dans les 5 premières secondes : rien", () => {
    expect(remarqueCibleIV("Plombiers, gagnez deux heures par semaine sur vos devis. Voici comment faire.", metier)).toEqual([]);
  });
  it("cible absente du début : une remarque en français", () => {
    const r = remarqueCibleIV("Bonjour à tous, voici une astuce pour gagner du temps. Les plombiers y gagnent.", metier);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatch(/plombier/);
    expect(r[0]).toMatch(/5 premières secondes/);
  });
});

describe("C100 dans la liste des contrôles", () => {
  it("est un contrôle connu, libellé en français, indicatif et placé en dernier", () => {
    expect(CODES_CONTROLE_IV).toContain("C100");
    expect(CODES_CONTROLE_IV[CODES_CONTROLE_IV.length - 1]).toBe("C100");
    expect(LIBELLES_CONTROLE_IV.C100).toMatch(/cible/i);
    expect(CONTROLES_INDICATIFS.has("C100")).toBe(true);
  });
  it("la porte ne le cite pas : rien ne le rend bloquant", () => {
    expect(readFileSync("src/moteurs/montage-image-video/porte.ts", "utf8")).not.toContain("C100");
  });
});
