import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DUREE_ZOOM_MOT_S,
  ECHELLE_PLEIN_CADRE,
  echelleMotDansCadre,
  permisDansPlan,
  zoomMot,
  zoomMotDansCadre,
} from "@/briques/motion/habillage-commun/transition-zoom-mot";
import { DUREES } from "@/briques/motion/jetons";
import { IDS_TRANSITIONS_COMMUNES } from "@/briques/motion/habillage-commun/transitions";

const SANS = { visageAvant: false, visageApres: false };
const PAS = Array.from({ length: 41 }, (_, i) => i / 40);
const LU = (f: string) => readFileSync(join(__dirname, "../../../src/briques/motion/habillage-commun", f), "utf8");

describe("zoom à travers un mot (X1-05)", () => {
  it("refuse (null) si l'une des deux scènes a un visage", () => {
    expect(zoomMot({ visageAvant: true, visageApres: false }, 0.5)).toBeNull();
    expect(zoomMot({ visageAvant: false, visageApres: true }, 0.5)).toBeNull();
    expect(zoomMot({ visageAvant: true, visageApres: true }, 0.5)).toBeNull();
    expect(zoomMot(SANS, 0.5)).not.toBeNull();
  });

  it("au plus 1 par vidéo (permisDansPlan)", () => {
    expect(permisDansPlan(0)).toBe(true);
    expect(permisDansPlan(1)).toBe(false);
    expect(permisDansPlan(3)).toBe(false);
  });

  it("échelle du mot monotone, de 1 à plein cadre, bornée", () => {
    let prec = 0;
    for (const t of PAS) {
      const e = zoomMot(SANS, t)!.echelleMot;
      expect(e).toBeGreaterThanOrEqual(1);
      expect(e).toBeLessThanOrEqual(ECHELLE_PLEIN_CADRE);
      expect(e).toBeGreaterThanOrEqual(prec);
      prec = e;
    }
    expect(zoomMot(SANS, 0)!.echelleMot).toBe(1);
    expect(zoomMot(SANS, 1)!.echelleMot).toBe(ECHELLE_PLEIN_CADRE);
    expect(zoomMot(SANS, -3)!.echelleMot).toBe(1);
    expect(zoomMot(SANS, 9)!.echelleMot).toBe(ECHELLE_PLEIN_CADRE);
  });

  it("ouverture de la scène suivante : monotone, 0 → 1, scène en place à la fin", () => {
    let prec = -1;
    for (const t of PAS) {
      const o = zoomMot(SANS, t)!.ouverture;
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(1);
      expect(o).toBeGreaterThanOrEqual(prec);
      prec = o;
    }
    expect(zoomMot(SANS, 0)!.ouverture).toBe(0);
    expect(zoomMot(SANS, 1)!.ouverture).toBe(1);
    expect(zoomMot(SANS, 1)!.echelleScene).toBe(1);
  });

  it("même entrée = même sortie", () => {
    for (const t of PAS) expect(zoomMot(SANS, t)).toEqual(zoomMot(SANS, t));
  });

  it("durée tirée de DUREES, non inscrite au catalogue, aucun hasard ni cubic-bezier", () => {
    expect(DUREE_ZOOM_MOT_S).toBe(DUREES.entreeLongue);
    expect([...IDS_TRANSITIONS_COMMUNES] as string[]).not.toContain("zoom-mot");
    const src = LU("transition-zoom-mot.ts");
    expect(src).not.toMatch(/Math\.random|Date\.now|performance\.now|cubic-bezier|from "@\//);
    expect(LU("choix.ts")).not.toMatch(/zoom-mot/);
  });
});

describe("zoom sur le mot : le mot ENTIER tient dans le cadre (FIX-X1-05-a)", () => {
  const FORMATS = [1080, 1080, 1080, 1920]; // largeurs de cadre : 9:16, 4:5, 1:1, 16:9
  const MOTS = Array.from({ length: 20 }, (_, i) => 3 + (i % 12)); // 3 à 14 lettres
  const MARGE = 40;

  it("critère : largeur × échelle ≤ cadre − 2 marges tant que le mot est visible (20 mots × 4 formats)", () => {
    for (const largeurCadre of FORMATS) {
      for (const lettres of MOTS) {
        const largeurMot = lettres * 24;
        for (const t of PAS) {
          const e = zoomMotDansCadre(SANS, t, { largeurMot, largeurCadre, marge: MARGE })!;
          if (e.ouverture < 1) expect(largeurMot * e.echelleMot).toBeLessThanOrEqual(largeurCadre - 2 * MARGE + 1e-6);
          expect(e.echelleMot).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("un mot court atteint encore l'échelle maximale ; un long est borné ; entrées invalides = 1", () => {
    expect(echelleMotDansCadre(10, 1080, 40)).toBe(ECHELLE_PLEIN_CADRE);
    expect(echelleMotDansCadre(336, 1080, 40)).toBeCloseTo(1000 / 336, 6);
    expect(echelleMotDansCadre(2000, 1080, 40)).toBe(1);
    for (const m of [0, -5, Number.NaN, Infinity]) expect(echelleMotDansCadre(m, 1080, 40)).toBe(1);
    expect(echelleMotDansCadre(100, Number.NaN, 40)).toBe(1);
    expect(echelleMotDansCadre(100, 1080, -1)).toBe(1);
  });

  it("zoomMot garde ses valeurs ; le refus visage est conservé ; monotone ; fin = plein cadre une fois la scène en place", () => {
    const sans = zoomMot(SANS, 0.5)!;
    expect(sans.echelleMot).toBeGreaterThan(1);
    expect(zoomMotDansCadre({ visageAvant: true, visageApres: false }, 0.5, { largeurMot: 100, largeurCadre: 1080, marge: 40 })).toBeNull();
    let prec = 0;
    for (const t of PAS) {
      const e = zoomMotDansCadre(SANS, t, { largeurMot: 300, largeurCadre: 1080, marge: 40 })!.echelleMot;
      expect(e).toBeGreaterThanOrEqual(prec);
      prec = e;
    }
    expect(zoomMotDansCadre(SANS, 1, { largeurMot: 300, largeurCadre: 1080, marge: 40 })!.echelleMot).toBe(ECHELLE_PLEIN_CADRE);
    expect(zoomMotDansCadre(SANS, 0, { largeurMot: 300, largeurCadre: 1080, marge: 40 })).toEqual(zoomMot(SANS, 0));
  });
});
