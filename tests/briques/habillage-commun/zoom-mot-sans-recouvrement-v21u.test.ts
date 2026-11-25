/** FIX-ZOOM-MOT-v21u — zoom sur un mot en trois temps : la scène d'en dessous s'efface, le mot seul grossit, la suivante arrive après. */
import { describe, expect, it } from "vitest";

import { DUREES } from "../../../src/briques/motion/jetons";
import {
  DUREE_ZOOM_MOT_S,
  DUREE_ZOOM_MOT_SANS_RECOUVREMENT_S,
  INSTANT_COUPE,
  SEUIL_RECOUVREMENT,
  ECHELLE_PLEIN_CADRE,
  zoomMot,
  zoomMotDansCadre,
  zoomMotSansRecouvrement,
} from "../../../src/briques/motion/habillage-commun/transition-zoom-mot";
import { PLAN_DEMO } from "../../../src/briques/plan-scenes/demo";
import type { IdPiece } from "../../../src/briques/plan-scenes/catalogue";
import { TOILES } from "../../../src/briques/plan-scenes/toiles";
import { ZONES, seChevauchent, type Rectangle } from "../../../src/briques/plan-scenes/zones";

const SANS = { visageAvant: false, visageApres: false };
const LARGEUR = 1080;
const HAUTEUR = 1920;
const TAILLE_MOT = 120;
const T = Array.from({ length: 1001 }, (_, i) => i / 1000);
const MOTS = Array.from({ length: 20 }, (_, i) => 3 + (i % 12));

function dessinee(piece: string, zone: Rectangle): Rectangle {
  const toile = TOILES[piece as keyof typeof TOILES];
  const zl = (zone.largeur / 100) * LARGEUR;
  const zh = (zone.hauteur / 100) * HAUTEUR;
  const k = Math.min(zl / toile.largeur, zh / toile.hauteur);
  const l = toile.largeur * k;
  const h = toile.hauteur * k;
  return { x: (zone.x / 100) * LARGEUR + (zl - l) / 2, y: (zone.y / 100) * HAUTEUR + (zh - h) / 2, largeur: l, hauteur: h };
}
const [s1, s2] = PLAN_DEMO.scenes;
const carte = dessinee(s1!.piece as IdPiece, ZONES[s1!.position]);
const fenetre = dessinee(s2!.piece as IdPiece, ZONES[s2!.position]);
const boiteMot = (largeurMot: number, echelle: number): Rectangle => {
  const l = largeurMot * echelle;
  const h = TAILLE_MOT * echelle;
  return { x: LARGEUR / 2 - l / 2, y: HAUTEUR / 2 - h / 2, largeur: l, hauteur: h };
};
const cadreDe = (lettres: number) => ({ largeurMot: lettres * 0.62 * TAILLE_MOT, largeurCadre: LARGEUR, marge: 40 });

describe("FIX-ZOOM-MOT (a) jamais le mot et la pièce d'en dessous ensemble", () => {
  it("(a) 1 001 instants × 20 mots : si les boîtes se coupent, jamais opaciteMot et opaciteSceneAvant > 5 % ensemble", () => {
    let coupes = 0;
    for (const lettres of MOTS)
      for (const t of T) {
        const e = zoomMotSansRecouvrement(SANS, t, cadreDe(lettres))!;
        if (seChevauchent(boiteMot(cadreDe(lettres).largeurMot, e.echelleMot), carte)) {
          coupes++;
          expect(e.opaciteMot > SEUIL_RECOUVREMENT && e.opaciteSceneAvant > SEUIL_RECOUVREMENT).toBe(false);
        }
      }
    expect(coupes).toBeGreaterThan(0);
  });
});

describe("FIX-ZOOM-MOT (b) jamais le mot et la scène suivante ensemble", () => {
  it("(b) même balayage avec ouverture et la boîte de s2", () => {
    let coupes = 0;
    for (const lettres of MOTS)
      for (const t of T) {
        const e = zoomMotSansRecouvrement(SANS, t, cadreDe(lettres))!;
        if (seChevauchent(boiteMot(cadreDe(lettres).largeurMot, e.echelleMot), fenetre)) {
          coupes++;
          expect(e.opaciteMot > SEUIL_RECOUVREMENT && e.ouverture > SEUIL_RECOUVREMENT).toBe(false);
        }
      }
    expect(coupes).toBeGreaterThan(0);
  });
});

describe("FIX-ZOOM-MOT (c) le mot se voit vraiment", () => {
  it("(c) au moins 30 % des instants à pleine opacité ; à la coupe : mot seul", () => {
    const pleins = T.filter((t) => zoomMotSansRecouvrement(SANS, t, cadreDe(6))!.opaciteMot === 1).length;
    expect(pleins / T.length).toBeGreaterThanOrEqual(0.3);
    const c = zoomMotSansRecouvrement(SANS, INSTANT_COUPE, cadreDe(6))!;
    expect(c.opaciteMot).toBe(1);
    expect(c.opaciteSceneAvant).toBe(0);
    expect(c.ouverture).toBe(0);
  });
});

describe("FIX-ZOOM-MOT (d) le mot reste entier", () => {
  const FORMATS = [1080, 1080, 1080, 1920];
  it("(d) largeur × échelle ≤ cadre − 2 marges tant que le mot est visible ; échelle monotone", () => {
    for (const largeurCadre of FORMATS)
      for (const lettres of MOTS) {
        const cadre = { largeurMot: lettres * 24, largeurCadre, marge: 40 };
        let prec = 0;
        for (const t of T) {
          const e = zoomMotSansRecouvrement(SANS, t, cadre)!;
          if (e.opaciteMot > 0) expect(cadre.largeurMot * e.echelleMot).toBeLessThanOrEqual(largeurCadre - 80 + 1e-6);
          expect(e.echelleMot).toBeGreaterThanOrEqual(prec);
          prec = e.echelleMot;
        }
      }
  });
});

describe("FIX-ZOOM-MOT (e) bornes et refus", () => {
  it("(e) t = 0 : scène d'avant seule ; t = 1 : scène suivante en place", () => {
    const a = zoomMotSansRecouvrement(SANS, 0, cadreDe(6))!;
    expect([a.opaciteSceneAvant, a.opaciteMot, a.ouverture]).toEqual([1, 0, 0]);
    const z = zoomMotSansRecouvrement(SANS, 1, cadreDe(6))!;
    expect([z.opaciteSceneAvant, z.opaciteMot, z.ouverture, z.echelleScene]).toEqual([0, 0, 1, 1]);
  });
  it("(e) entrées hors [0, 1] ou non finies bornées ; refus visage", () => {
    expect(zoomMotSansRecouvrement(SANS, -3, cadreDe(6))).toEqual(zoomMotSansRecouvrement(SANS, 0, cadreDe(6)));
    expect(zoomMotSansRecouvrement(SANS, 9, cadreDe(6))).toEqual(zoomMotSansRecouvrement(SANS, 1, cadreDe(6)));
    expect(zoomMotSansRecouvrement(SANS, Number.NaN, cadreDe(6))).toEqual(zoomMotSansRecouvrement(SANS, 0, cadreDe(6)));
    expect(zoomMotSansRecouvrement({ visageAvant: true, visageApres: false }, 0.5, cadreDe(6))).toBeNull();
    expect(zoomMotSansRecouvrement({ visageAvant: false, visageApres: true }, 0.5, cadreDe(6))).toBeNull();
  });
  it("(e) même entrée = même sortie ; 2e appel identique", () => {
    for (const t of [0, 0.3, 0.5, 0.9]) expect(zoomMotSansRecouvrement(SANS, t, cadreDe(6))).toEqual(zoomMotSansRecouvrement(SANS, t, cadreDe(6)));
  });
});

describe("FIX-ZOOM-MOT (f) l'ancien zoom ne bouge pas", () => {
  it("(f) zoomMot : valeurs de master recopiées (échelle 8^p, opacité 1) ; zoomMotDansCadre = zoomMot sans bornage", () => {
    expect(zoomMot(SANS, 0)).toEqual({ echelleMot: 1, opaciteMot: 1, ouverture: 0, echelleScene: 1.15 });
    expect(zoomMot(SANS, 1)).toEqual({ echelleMot: ECHELLE_PLEIN_CADRE, opaciteMot: 1, ouverture: 1, echelleScene: 1 });
    for (const t of T.filter((_, i) => i % 25 === 0)) {
      const e = zoomMot(SANS, t)!;
      expect(e.opaciteMot).toBe(1);
      expect(zoomMotDansCadre(SANS, t, { largeurMot: 10, largeurCadre: 1080, marge: 40 })).toEqual(e);
    }
    // Table recopiée de master (9402be05) : 5 instants.
    expect(zoomMot(SANS, 0.1)).toEqual({ echelleMot: 3.9121, opaciteMot: 1, ouverture: 0, echelleScene: 1.15 });
    expect(zoomMot(SANS, 0.25)).toEqual({ echelleMot: 6.9544, opaciteMot: 1, ouverture: 0, echelleScene: 1.15 });
    expect(zoomMot(SANS, 0.5)).toEqual({ echelleMot: 7.9705, opaciteMot: 1, ouverture: 0.4605, echelleScene: 1.0809 });
    expect(zoomMot(SANS, 0.75)).toEqual({ echelleMot: 8, opaciteMot: 1, ouverture: 0.9805, echelleScene: 1.0029 });
    expect(zoomMot(SANS, 0.9)).toEqual({ echelleMot: 8, opaciteMot: 1, ouverture: 0.9992, echelleScene: 1.0001 });
  });
  it("(f) durées tirées de DUREES", () => {
    expect(DUREE_ZOOM_MOT_S).toBe(DUREES.entreeLongue);
    expect(DUREE_ZOOM_MOT_SANS_RECOUVREMENT_S).toBe(2 * DUREES.entreeLongue);
  });
});
