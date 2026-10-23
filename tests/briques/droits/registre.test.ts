import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DROITS, TYPES_PIECE, droitValide, trouverDroit } from "../../../src/briques/droits";
import type { EntreeDroit } from "../../../src/briques/droits";

const DOSSIER = new URL("../../../src/briques/droits/registre/", import.meta.url);
const FICHIERS = readdirSync(DOSSIER)
  .filter((f) => f.endsWith(".ts") && f !== "index.ts")
  .map((f) => f.replace(/\.ts$/, ""));

describe("registre des droits", () => {
  it("identifiants uniques", () => {
    const ids = DROITS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("index complet : chaque fichier du dossier est dans l'index, et inversement", () => {
    expect([...DROITS.map((d) => d.id)].sort()).toEqual([...FICHIERS].sort());
  });

  it("chaque entrée est complète et son identifiant = son nom de fichier", () => {
    for (const d of DROITS) {
      expect(TYPES_PIECE).toContain(d.type);
      for (const champ of ["id", "licence", "auteur", "preuve"] as const) expect(d[champ].trim(), `${d.id}.${champ}`).not.toBe("");
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (d.perimeLe !== undefined) expect(d.perimeLe).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(FICHIERS).toContain(d.id);
    }
  });

  it("entrées de départ présentes", () => {
    expect(trouverDroit("stylo-crayon-1")?.type).toBe("stylo");
    expect(trouverDroit("icones-motion-lucide")?.licence).toBe("ISC");
    expect(DROITS.filter((d) => d.id.startsWith("dessin-"))).toHaveLength(40);
  });

  it("trouverDroit : absent → undefined ; droitValide : absent → faux", () => {
    expect(trouverDroit("nexiste-pas")).toBeUndefined();
    expect(droitValide("nexiste-pas")).toBe(false);
  });

  it("droitValide sans péremption : toujours vrai", () => {
    expect(droitValide("stylo-crayon-1", "2099-01-01")).toBe(true);
  });

  it("péremption : valide avant la date, périmé à la date et après", () => {
    const perime: EntreeDroit = { id: "x", type: "son", licence: "l", auteur: "a", preuve: "p", date: "2026-01-01", perimeLe: "2027-01-01" };
    (DROITS as EntreeDroit[]).push(perime);
    try {
      expect(droitValide("x", "2026-12-31")).toBe(true);
      expect(droitValide("x", new Date("2026-12-31T23:59:59Z"))).toBe(true);
      expect(droitValide("x", "2027-01-01")).toBe(false);
      expect(droitValide("x", "2028-06-01")).toBe(false);
    } finally {
      (DROITS as EntreeDroit[]).pop();
    }
  });
});
