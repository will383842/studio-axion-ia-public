import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DUREE_ZOOM_MOT_S,
  ECHELLE_PLEIN_CADRE,
  permisDansPlan,
  zoomMot,
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
