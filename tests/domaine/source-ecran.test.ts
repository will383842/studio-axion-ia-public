import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lireSuiviSourceEcran, type SuiviSourceEcran } from "@/domaine/source-ecran";

const valide: SuiviSourceEcran = {
  version: 1,
  origine: "navigateur",
  imagesParSeconde: 30,
  largeur: 1920,
  hauteur: 1080,
  curseur: [{ tMs: 0, x: 10, y: 20 }, { tMs: 100, x: 50, y: 60 }],
  clics: [{ tMs: 100, x: 50, y: 60 }],
  zones: [{ debutMs: 0, finMs: 500, x: 10, y: 10, largeur: 30, hauteur: 20, motif: "mot de passe" }],
  attestation: { texte: "Messages et mots de passe fermés.", le: "2026-11-15" },
};

describe("lireSuiviSourceEcran", () => {
  it("relit à l'identique un suivi complet valide", () => {
    const r = lireSuiviSourceEcran(JSON.parse(JSON.stringify(valide)));
    expect(r.suivi).toEqual(valide);
    expect(r.remarques).toEqual([]);
  });

  it("accepte une attestation absente", () => {
    const { attestation: _a, ...sans } = valide;
    const r = lireSuiviSourceEcran(sans);
    expect(r.suivi).not.toBeNull();
    expect(r.suivi?.attestation).toBeUndefined();
  });

  it("écarte et compte les points invalides, sans en citer le contenu", () => {
    const r = lireSuiviSourceEcran({
      ...valide,
      curseur: [{ tMs: Number.NaN, x: 1, y: 1 }, { tMs: -5, x: 1, y: 1 }, { tMs: 10, x: "a", y: 1 }, { tMs: 20, x: 5, y: 5 }],
      clics: [null, { tMs: 1, x: Number.NaN, y: 2 }],
      zones: [{ debutMs: 10, finMs: 5, x: 0, y: 0, largeur: 10, hauteur: 10 }, { debutMs: 0, finMs: 5, x: 0, y: 0, largeur: 0, hauteur: 10 }],
    });
    expect(r.suivi?.curseur).toEqual([{ tMs: 20, x: 5, y: 5 }]);
    expect(r.suivi?.clics).toEqual([]);
    expect(r.suivi?.zones).toEqual([]);
    expect(r.remarques.join(" ")).toMatch(/curseur : 3 /);
    expect(r.remarques.join(" ")).toMatch(/2/);
    expect(JSON.stringify(r.remarques)).not.toContain("mot de passe");
  });

  it("borne les coordonnées à 0-100", () => {
    const r = lireSuiviSourceEcran({
      ...valide,
      curseur: [{ tMs: 0, x: 150, y: -10 }],
      zones: [{ debutMs: 0, finMs: 10, x: 90, y: 90, largeur: 50, hauteur: 50 }],
    });
    expect(r.suivi?.curseur[0]).toEqual({ tMs: 0, x: 100, y: 0 });
    expect(r.suivi?.zones[0]).toMatchObject({ x: 90, y: 90, largeur: 10, hauteur: 10 });
  });

  it("trie par temps", () => {
    const r = lireSuiviSourceEcran({ ...valide, curseur: [{ tMs: 30, x: 1, y: 1 }, { tMs: 10, x: 2, y: 2 }], clics: [{ tMs: 9, x: 1, y: 1 }, { tMs: 3, x: 1, y: 1 }], zones: [{ debutMs: 50, finMs: 60, x: 0, y: 0, largeur: 1, hauteur: 1 }, { debutMs: 5, finMs: 6, x: 0, y: 0, largeur: 1, hauteur: 1 }] });
    expect(r.suivi?.curseur.map((p) => p.tMs)).toEqual([10, 30]);
    expect(r.suivi?.clics.map((p) => p.tMs)).toEqual([3, 9]);
    expect(r.suivi?.zones.map((z) => z.debutMs)).toEqual([5, 50]);
  });

  it("applique les plafonds", () => {
    const pts = (n: number) => Array.from({ length: n }, (_, i) => ({ tMs: i, x: 1, y: 1 }));
    const zs = Array.from({ length: 250 }, (_, i) => ({ debutMs: i, finMs: i + 1, x: 0, y: 0, largeur: 1, hauteur: 1 }));
    const r = lireSuiviSourceEcran({ ...valide, curseur: pts(20500), clics: pts(2100), zones: zs });
    expect(r.suivi?.curseur).toHaveLength(20000);
    expect(r.suivi?.clics).toHaveLength(2000);
    expect(r.suivi?.zones).toHaveLength(200);
    expect(r.remarques.length).toBeGreaterThanOrEqual(3);
  });

  it("imagesParSeconde hors 1-120 donne null avec remarque", () => {
    for (const fps of [0, 121, Number.NaN, "30"]) {
      const r = lireSuiviSourceEcran({ ...valide, imagesParSeconde: fps });
      expect(r.suivi).toBeNull();
      expect(r.remarques.length).toBeGreaterThan(0);
    }
  });

  it("ne lève jamais : null, chaîne, tableau, nombre, undefined", () => {
    for (const e of [null, undefined, "texte", [], [valide], 42, true]) {
      const r = lireSuiviSourceEcran(e);
      expect(r.suivi).toBeNull();
    }
  });

  it("origine inconnue ou absente devient « inconnue » ; listes absentes vides", () => {
    const r = lireSuiviSourceEcran({ imagesParSeconde: 24, largeur: 100, hauteur: 50, origine: "autre" });
    expect(r.suivi).toMatchObject({ origine: "inconnue", curseur: [], clics: [], zones: [] });
  });

  it("garde statique : aucun import de src/services", () => {
    const src = readFileSync("src/domaine/source-ecran.ts", "utf8");
    expect(src).not.toMatch(/services/);
    expect(src).not.toMatch(/from\s+["']node:/);
  });
});
