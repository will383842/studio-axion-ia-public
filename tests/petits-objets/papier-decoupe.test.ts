/** X1-10 — papier découpé et ruban adhésif : pièces pures, non inscrites, éteintes. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  AMPLITUDE_BORD_MAX_POURCENT, COULEURS_PAPIER, bordDechire, papierDecoupe, rubanAdhesif, scenesPapierAutorisees, peutPoserPapier,
} from "../../src/briques/motion/petits-objets/papier-decoupe";
import { CHARTE_AXION } from "../../src/briques/jetons-motion";

const ZONE = { x: 10, y: 70, largeur: 40, hauteur: 20 };
const SANS_VISAGE = { x: 22, y: 14, largeur: 56, hauteur: 42 };

describe("bordDechire", () => {
  it("même graine = même bord ; autre graine = autre bord", () => {
    expect(bordDechire(42, 24)).toEqual(bordDechire(42, 24));
    expect(bordDechire(42, 24)).not.toEqual(bordDechire(43, 24));
  });
  it("amplitude ≤ 2 % de la largeur", () => {
    for (let g = 0; g < 200; g++) for (const d of bordDechire(g * 7919, 40)) expect(Math.abs(d)).toBeLessThanOrEqual(AMPLITUDE_BORD_MAX_POURCENT);
    expect(AMPLITUDE_BORD_MAX_POURCENT).toBeLessThanOrEqual(2);
  });
  it("nombre de points borné, entrées absurdes sans exception", () => {
    expect(bordDechire(1, 24)).toHaveLength(24);
    for (const n of [NaN, -3, 0, Infinity, 1e9]) expect(() => bordDechire(1, n)).not.toThrow();
    expect(bordDechire(1, 1e9).length).toBeLessThanOrEqual(200);
  });
});

describe("papierDecoupe", () => {
  it("couleurs ivoire, gris, blanc seulement", () => {
    const permises = new Set([CHARTE_AXION.ivoire, CHARTE_AXION.gris, "#FFFFFF"].map((c) => c.toUpperCase()));
    for (const c of COULEURS_PAPIER) expect(permises.has(c.toUpperCase())).toBe(true);
    for (let g = 0; g < 50; g++) {
      const p = papierDecoupe({ graine: g, zone: ZONE });
      if (p === null) throw new Error("zone valide refusée");
      expect(permises.has(p.couleur.toUpperCase())).toBe(true);
    }
  });
  it("même entrée = même papier", () => {
    expect(papierDecoupe({ graine: 9, zone: ZONE })).toEqual(papierDecoupe({ graine: 9, zone: ZONE }));
  });
  it("jamais devant le visage : refus (null)", () => {
    expect(papierDecoupe({ graine: 1, zone: SANS_VISAGE })).toBeNull();
    expect(papierDecoupe({ graine: 1, zone: { x: 30, y: 20, largeur: 10, hauteur: 10 } })).toBeNull();
    expect(papierDecoupe({ graine: 1, zone: { x: NaN, y: 0, largeur: 1, hauteur: 1 } })).toBeNull();
  });
  it("le ruban est un rectangle translucide ivoire dans la zone", () => {
    const r = rubanAdhesif(ZONE);
    expect(r.couleur.toLowerCase()).toContain("250, 249, 245");
    expect(r.opacite).toBeGreaterThan(0);
    expect(r.opacite).toBeLessThan(1);
    expect(r.boite.x).toBeGreaterThanOrEqual(ZONE.x);
    expect(r.boite.x + r.boite.largeur).toBeLessThanOrEqual(ZONE.x + ZONE.largeur + 1e-9);
  });
});

describe("règle « au plus 1 scène sur 3 »", () => {
  it("scenesPapierAutorisees = plancher(n / 3)", () => {
    expect([0, 1, 2, 3, 5, 6, 10].map(scenesPapierAutorisees)).toEqual([0, 0, 0, 1, 1, 2, 3]);
    expect(scenesPapierAutorisees(NaN)).toBe(0);
  });
  it("peutPoserPapier refuse au-delà du quota", () => {
    expect(peutPoserPapier(0, 3)).toBe(true);
    expect(peutPoserPapier(1, 3)).toBe(false);
    expect(peutPoserPapier(2, 6)).toBe(false);
    expect(peutPoserPapier(1, 6)).toBe(true);
    expect(peutPoserPapier(0, 2)).toBe(false);
  });
});

describe("éteint = identique", () => {
  it("rien d'autre n'importe ces fichiers", () => {
    const idx = readFileSync(new URL("../../src/briques/motion/petits-objets/index.ts", import.meta.url), "utf8");
    expect(idx).not.toMatch(/papier-decoupe/);
  });
  it("aucune courbe libre, aucun Math.random, imports relatifs", () => {
    const t = readFileSync(new URL("../../src/briques/motion/petits-objets/papier-decoupe.ts", import.meta.url), "utf8");
    expect(t).not.toMatch(/cubic-bezier|Math\.random|@\//);
  });
});
