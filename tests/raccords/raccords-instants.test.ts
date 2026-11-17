/**
 * C6-H24c-b · `etatRaccordA` : état pur d'un raccord à une image donnée. NON branché : rien ne l'importe. 25 i/s.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { etatRaccordA } from "../../studio-rendu/src/composition/raccords-instants";

const FPS = 25;
// Plans : 2 s, 3 s, 2 s, 1 s (limites aux images 50, 125, 175).
const P = [
  { debutImage: 0, finImage: 50 },
  { debutImage: 50, finImage: 125 },
  { debutImage: 125, finImage: 175 },
  { debutImage: 175, finImage: 200 },
];
const FONDU = [{ indexAvant: 0, type: "fondu" as const }];
const GLISSE = [{ indexAvant: 0, type: "glissement" as const }];

/** Images de la fenêtre du raccord 0 (limite = image 50, durée 0,3 s = 7,5 → 8 images, de 46 à 53). */
const fenetre = (raccords: { indexAvant: number; type: "fondu" | "glissement" }[] = FONDU, options = {}) => {
  const out: number[] = [];
  for (let i = 0; i < 200; i++) if (etatRaccordA(i, FPS, P, raccords, options)) out.push(i);
  return out;
};

describe("etatRaccordA", () => {
  it("sans raccord → null à toutes les images", () => {
    for (let i = -2; i < 205; i++) expect(etatRaccordA(i, FPS, P, [])).toBeNull();
  });

  it("fenêtre exacte, centrée sur la limite, contiguë", () => {
    const f = fenetre();
    expect(f).toHaveLength(8);
    expect(f[0]).toBe(46);
    expect(f[f.length - 1]).toBe(53);
    expect(f.every((x, k) => k === 0 || x === f[k - 1]! + 1)).toBe(true);
    expect(etatRaccordA(45, FPS, P, FONDU)).toBeNull();
    expect(etatRaccordA(54, FPS, P, FONDU)).toBeNull();
  });

  it("opacités complémentaires (somme = 1), monotones, sans dépassement", () => {
    const f = fenetre();
    let av = 2;
    let ap = -1;
    for (const i of f) {
      const e = etatRaccordA(i, FPS, P, FONDU)!;
      expect(e.indexAvant).toBe(0);
      expect(e.opaciteAvant + e.opaciteApres).toBeCloseTo(1, 12);
      expect(e.opaciteAvant).toBeGreaterThanOrEqual(0);
      expect(e.opaciteApres).toBeLessThanOrEqual(1);
      expect(e.opaciteAvant).toBeLessThanOrEqual(av);
      expect(e.opaciteApres).toBeGreaterThanOrEqual(ap);
      av = e.opaciteAvant;
      ap = e.opaciteApres;
    }
    // Le plan sortant domine au début, l'entrant à la fin.
    expect(etatRaccordA(f[0]!, FPS, P, FONDU)!.opaciteAvant).toBeGreaterThan(0.5);
    expect(etatRaccordA(f[f.length - 1]!, FPS, P, FONDU)!.opaciteApres).toBeGreaterThan(0.5);
  });

  it("fondu : aucun décalage", () => {
    for (const i of fenetre()) {
      const e = etatRaccordA(i, FPS, P, FONDU)!;
      expect(e.decalageAvantPx).toBe(0);
      expect(e.decalageApresPx).toBe(0);
    }
  });

  it("glissement : décalage borné à 8 % de la largeur, monotone, sans rebond", () => {
    const L = 1080;
    let abs = -1;
    let reste = 99999;
    for (const i of fenetre(GLISSE)) {
      const e = etatRaccordA(i, FPS, P, GLISSE, { largeurPx: L })!;
      expect(Math.abs(e.decalageAvantPx)).toBeLessThanOrEqual(0.08 * L + 1e-9);
      expect(Math.abs(e.decalageApresPx)).toBeLessThanOrEqual(0.08 * L + 1e-9);
      expect(e.decalageAvantPx).toBeLessThanOrEqual(0); // le sortant part à gauche
      expect(e.decalageApresPx).toBeGreaterThanOrEqual(0); // l'entrant arrive de la droite
      expect(-e.decalageAvantPx).toBeGreaterThanOrEqual(abs); // sortant : s'éloigne sans revenir
      expect(e.decalageApresPx).toBeLessThanOrEqual(reste); // entrant : se rapproche sans dépasser
      abs = -e.decalageAvantPx;
      reste = e.decalageApresPx;
    }
  });

  it("flou 0 par défaut ; 6 ou 12 seulement si passé ; autre valeur → 0", () => {
    for (const i of fenetre()) expect(etatRaccordA(i, FPS, P, FONDU)!.flouPx).toBe(0);
    expect(etatRaccordA(50, FPS, P, FONDU, { flouPx: 6 })!.flouPx).toBe(6);
    expect(etatRaccordA(50, FPS, P, FONDU, { flouPx: 12 })!.flouPx).toBe(12);
    expect(etatRaccordA(50, FPS, P, FONDU, { flouPx: 9 as 6 })!.flouPx).toBe(0);
  });

  it("durée bornée : 0,4 s au plus, et moitié du plus court plan", () => {
    expect(fenetre(FONDU, { dureeSec: 5 })).toHaveLength(10); // 0,4 s × 25
    // plans 3 et 4 : 2 s et 1 s → 0,5 s, donc le plafond de 0,4 s s'applique encore ; plans 0,6 s → 0,3 s
    const courts = [
      { debutImage: 0, finImage: 15 },
      { debutImage: 15, finImage: 30 },
    ];
    let n = 0;
    for (let i = 0; i < 30; i++) if (etatRaccordA(i, FPS, courts, [{ indexAvant: 0, type: "fondu" }], { dureeSec: 0.4 })) n++;
    expect(n).toBeLessThanOrEqual(8); // 0,6 s / 2 = 0,3 s → 7,5 → 8 images au plus
  });

  it("raccord invalide ou hors plans → null ; fps invalide → null", () => {
    expect(etatRaccordA(50, FPS, P, [{ indexAvant: 3, type: "fondu" }])).toBeNull();
    expect(etatRaccordA(50, FPS, P, [{ indexAvant: -1, type: "fondu" }])).toBeNull();
    expect(etatRaccordA(50, 0, P, FONDU)).toBeNull();
  });

  it("déterministe", () => {
    expect(etatRaccordA(48, FPS, P, GLISSE)).toEqual(etatRaccordA(48, FPS, P, GLISSE));
  });

  it("garde statique : aucun import de src/", () => {
    const s = readFileSync("studio-rendu/src/composition/raccords-instants.ts", "utf8");
    expect(s).not.toMatch(/from\s+["'](\.\.\/)*src\//);
    expect(s).not.toMatch(/from\s+["']@\//);
    expect(s).not.toMatch(/bibliotheque-video/);
  });
});
