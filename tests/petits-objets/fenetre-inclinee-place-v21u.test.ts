/** FIX-FENETRE-INCLINEE-v21u — où la fenêtre inclinée se pose : zone libre, sinon à la place d'une pièce, jamais sur un sous-titre ni une carte. */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import {
  FenetreInclineeVue,
  LARGEUR_MIN_POURCENT,
  MARGE_INCLINAISON,
  angleFenetre,
  boiteFenetreDessinee,
  placerFenetreInclinee,
  plusGrandRectangleLibre,
} from "../../src/briques/motion/petits-objets/fenetre-inclinee";
import type { ParametresFenetreApp } from "../../src/briques/motion/petits-objets/fenetre-app";
import { EXEMPLES_FENETRE_APP } from "../../src/briques/motion/petits-objets/fenetre-app";
import { PLAN_DEMO, MOTS_DEMO, SCRIPT_DEMO } from "../../src/briques/plan-scenes/demo";
import { TOILES } from "../../src/briques/plan-scenes/toiles";
import { ZONES, ZONE_VISAGE, seChevauchent, type Rectangle } from "../../src/briques/plan-scenes/zones";
import { donneesCalque, elementDe, fabriquerSousTitres } from "../../src/briques/sous-titres";

const CADRE = { largeur: 1080, hauteur: 1920 };
const PARAMS: ParametresFenetreApp = { largeur: 70, hauteur: 60, titre: "Axion CRM" };
const touche = (a: Rectangle, b: Rectangle) => seChevauchent(a, b);

/** Boîte (en % du cadre) du texte d'un sous-titre à y % de la hauteur. */
const ligneSousTitre = (yPct: number): Rectangle => ({ x: 5, y: yPct - 4.9, largeur: 90, hauteur: 9.8 });

/** Boîte dessinée d'une pièce posée dans sa zone : toile centrée, proportions gardées (en %). */
function boiteDessineeDePiece(zone: Rectangle, toile: { largeur: number; hauteur: number }): Rectangle {
  const zl = (zone.largeur * CADRE.largeur) / 100;
  const zh = (zone.hauteur * CADRE.hauteur) / 100;
  const k = Math.min(zl / toile.largeur, zh / toile.hauteur);
  const l = toile.largeur * k;
  const h = toile.hauteur * k;
  const cx = (zone.x * CADRE.largeur) / 100 + zl / 2;
  const cy = (zone.y * CADRE.hauteur) / 100 + zh / 2;
  return { x: ((cx - l / 2) / CADRE.largeur) * 100, y: ((cy - h / 2) / CADRE.hauteur) * 100, largeur: (l / CADRE.largeur) * 100, hauteur: (h / CADRE.hauteur) * 100 };
}

describe("FIX-FENETRE-INCLINEE (a) zone libre d'abord", () => {
  it("(a) une pièce en haut, sous-titres à 65 % : posée en zone libre, sans contact, remplace = null", () => {
    const piece = ZONES.haut;
    const st = ligneSousTitre(65);
    const r = placerFenetreInclinee({ parametres: PARAMS, occupees: [piece], sousTitres: [st], cadre: CADRE });
    expect(r).not.toBeNull();
    expect(r!.remplace).toBeNull();
    const d = boiteFenetreDessinee(r!.boite, PARAMS, CADRE);
    expect(touche(d, piece)).toBe(false);
    expect(touche(d, st)).toBe(false);
    expect(d.largeur).toBeGreaterThanOrEqual(LARGEUR_MIN_POURCENT);
  });
  it("(a) plus grand rectangle libre : 3 cas écrits à la main", () => {
    const u: Rectangle = { x: 0, y: 0, largeur: 100, hauteur: 100 };
    expect(plusGrandRectangleLibre([], u)).toEqual(u);
    expect(plusGrandRectangleLibre([{ x: 0, y: 0, largeur: 100, hauteur: 40 }], u)).toEqual({ x: 0, y: 40, largeur: 100, hauteur: 60 });
    expect(plusGrandRectangleLibre([{ x: 0, y: 0, largeur: 50, hauteur: 100 }, { x: 50, y: 0, largeur: 50, hauteur: 100 }], u)).toBeNull();
  });
  it("(a) liste vide : tout le cadre utile, 2e appel identique (pur)", () => {
    const a = placerFenetreInclinee({ parametres: PARAMS, occupees: [], sousTitres: [], cadre: CADRE });
    const b = placerFenetreInclinee({ parametres: PARAMS, occupees: [], sousTitres: [], cadre: CADRE });
    expect(a).toEqual(b);
    expect(a).toEqual({ boite: { x: 5, y: 3, largeur: 90, hauteur: 94 }, remplace: null });
  });
});

describe("FIX-FENETRE-INCLINEE (b) garde par boîtes sur la vraie scène de démonstration", () => {
  const s1 = PLAN_DEMO.scenes[0]!;
  const carte = boiteDessineeDePiece(ZONES[s1.position], TOILES["carte-kpi"]);
  const mots = MOTS_DEMO.map((m) => ({ mot: m.texte, debutSec: m.debutMs / 1000, finSec: m.finMs / 1000 }));
  const segments = fabriquerSousTitres({ texte: SCRIPT_DEMO, dureeSec: 15, mots, base: "karaoke" });
  const d = donneesCalque({ segments, base: "karaoke", ratio: "9:16", style: { positionPct: 65 } as never });
  const sousTitres: Rectangle[] = d.segments
    .filter((s) => s.debutSec < 4)
    .map((s) => {
      const el = elementDe(d, s, s.debutSec);
      return {
        x: ((d.largeur - d.largeurMaxPx) / 2 / d.largeur) * 100,
        y: ((el.yPx - 0.75 * el.taillePx) / d.hauteur) * 100,
        largeur: (d.largeurMaxPx / d.largeur) * 100,
        hauteur: ((1.5 * el.taillePx) / d.hauteur) * 100,
      };
    });
  it("(b) la démonstration a bien une carte et des sous-titres", () => {
    expect(sousTitres.length).toBeGreaterThan(0);
    expect(carte.largeur).toBeGreaterThan(50);
  });
  it("(b) fenêtre posée, sans contact avec aucun sous-titre ; la carte seulement si elle est remplacée", () => {
    const r = placerFenetreInclinee({ parametres: PARAMS, occupees: [carte], sousTitres, cadre: CADRE });
    expect(r).not.toBeNull();
    const dess = boiteFenetreDessinee(r!.boite, PARAMS, CADRE);
    for (const st of sousTitres) expect(touche(dess, st)).toBe(false);
    if (r!.remplace === null) expect(touche(dess, carte)).toBe(false);
    else expect(r!.remplace).toBe(0);
    console.warn("FENETRE-DEMO", JSON.stringify({ mode: r!.remplace === null ? "libre" : "remplace", boite: r!.boite, dessinee: dess, carte, sousTitres }));
  });
});

describe("FIX-FENETRE-INCLINEE (c) jamais par-dessus un sous-titre", () => {
  it("(c) balayage déterministe de 200 configurations", () => {
    const noms = Object.keys(ZONES).filter((n) => n !== "plein") as (keyof typeof ZONES)[];
    let posees = 0;
    let n = 0;
    for (let a = 0; a < noms.length; a++)
      for (let b = a; b < noms.length; b++)
        for (const pct of [20, 35, 48, 65, 80])
          for (const p of EXEMPLES_FENETRE_APP) {
            n++;
            const occupees = a === b ? [ZONES[noms[a]!]] : [ZONES[noms[a]!], ZONES[noms[b]!]];
            const st = ligneSousTitre(pct);
            const r = placerFenetreInclinee({ parametres: p, occupees, sousTitres: [st], cadre: CADRE });
            if (!r) continue;
            posees++;
            const d = boiteFenetreDessinee(r.boite, p, CADRE);
            expect(touche(d, st)).toBe(false);
            occupees.forEach((o, i) => {
              if (i !== r.remplace) expect(touche(d, o)).toBe(false);
            });
          }
    expect(n).toBeGreaterThanOrEqual(200);
    expect(posees).toBeGreaterThan(0);
  });
  it("(c) mode « remplace » exercé : une grande carte qui occupe tout, sans sous-titre dessus", () => {
    const grande: Rectangle = { x: 5, y: 10, largeur: 90, hauteur: 60 };
    const r = placerFenetreInclinee({ parametres: PARAMS, occupees: [grande], sousTitres: [ligneSousTitre(85)], cadre: CADRE });
    expect(r).not.toBeNull();
    expect(r!.remplace).toBe(0);
    expect(touche(boiteFenetreDessinee(r!.boite, PARAMS, CADRE), ligneSousTitre(85))).toBe(false);
  });
});

describe("FIX-FENETRE-INCLINEE (d) jamais devant le visage", () => {
  it("(d) avec visage : la boîte dessinée ne touche jamais ZONE_VISAGE", () => {
    for (const occ of [[], [ZONES.bas], [ZONES.gauche, ZONES.droite]] as Rectangle[][])
      for (const p of EXEMPLES_FENETRE_APP) {
        const r = placerFenetreInclinee({ parametres: p, occupees: occ, sousTitres: [], visage: true, cadre: CADRE });
        if (r) expect(touche(boiteFenetreDessinee(r.boite, p, CADRE), ZONE_VISAGE)).toBe(false);
      }
  });
});

describe("FIX-FENETRE-INCLINEE (e) sinon pas posée", () => {
  it("(e) sous-titres sur tout le cadre : null", () => {
    expect(placerFenetreInclinee({ parametres: PARAMS, occupees: [], sousTitres: [ZONES.plein], cadre: CADRE })).toBeNull();
  });
  it("(e) zone libre trop étroite et rien à remplacer : null", () => {
    const etroit: Rectangle = { x: 0, y: 0, largeur: 100, hauteur: 94 };
    expect(placerFenetreInclinee({ parametres: PARAMS, occupees: [], sousTitres: [{ ...etroit, x: 5 + 30, largeur: 60 }, { x: 0, y: 0, largeur: 35, hauteur: 100 }], cadre: CADRE })).toBeNull();
  });
});

describe("FIX-FENETRE-INCLINEE (e) borne de remplacement", () => {
  const piece: Rectangle = { x: 5, y: 3, largeur: 90, hauteur: 80 };
  const st = (hauteur: number): Rectangle => ({ x: 0, y: 3, largeur: 100, hauteur });
  it("(e) la zone libérée couvre 25 % de la pièce (< 50 %) : pas « à sa place », null", () => {
    expect(placerFenetreInclinee({ parametres: PARAMS, occupees: [piece], sousTitres: [st(60)], cadre: CADRE })).toBeNull();
  });
  it("(e) la zone libérée couvre exactement 50 % de la pièce : remplace = 0 ; juste en dessous : null", () => {
    // sous-titres de y 3 à 43 : libérée y 43 → 97 ; recouvrement avec la pièce (3 → 83) = 40 sur 80 = 50 %.
    const r = placerFenetreInclinee({ parametres: PARAMS, occupees: [piece], sousTitres: [st(40)], cadre: CADRE });
    expect(r?.remplace).toBe(0);
    expect(placerFenetreInclinee({ parametres: PARAMS, occupees: [piece], sousTitres: [st(40.5)], cadre: CADRE })).toBeNull();
  });
});

describe("FIX-FENETRE-INCLINEE (f) la vue suit la boîte, et sans boîte rien ne change", () => {
  const base = { image: 30, fps: 25, dureeImages: 75, fond: "ivoire" as const, graine: 1, parametres: PARAMS };
  it("(f) avec boîte : left/top/width/height en %, sans inset:0 sur la racine", () => {
    const html = renderToStaticMarkup(createElement(FenetreInclineeVue, { ...base, boite: { x: 5, y: 3, largeur: 90, hauteur: 32.4 } }));
    expect(html.startsWith('<div style="position:absolute;left:5%;top:3%;width:90%;height:32.4%;container-type:size">')).toBe(true);
  });
  it("(f) sans boîte : racine inset:0, HTML identique à boite: undefined", () => {
    const sans = renderToStaticMarkup(createElement(FenetreInclineeVue, base));
    expect(sans.startsWith('<div style="position:absolute;inset:0;container-type:size">')).toBe(true);
    expect(renderToStaticMarkup(createElement(FenetreInclineeVue, { ...base, boite: undefined }))).toBe(sans);
  });
});

describe("FIX-FENETRE-INCLINEE marge d'inclinaison", () => {
  it("la fenêtre à 20° (angle plein) tient dans la marge : projection des coins au pire angle", () => {
    const a = angleFenetre(0);
    const rad = (dg: number) => (dg * Math.PI) / 180;
    // Coins (±1, ±1) de la fenêtre à plat (unité = demi-largeur) ; perspective = 150 % de la hauteur de la boîte (622 px pour 435 px de fenêtre, scène de démonstration) soit 933 / 217 demi-largeurs.
    const P = 933 / 217;
    let pire = 0;
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        const x0 = sx;
        const y0 = sy;
        const y1 = y0 * Math.cos(rad(a.rotateX));
        const z1 = y0 * Math.sin(rad(a.rotateX));
        const x2 = x0 * Math.cos(rad(a.rotateY)) + z1 * Math.sin(rad(a.rotateY));
        const z2 = -x0 * Math.sin(rad(a.rotateY)) + z1 * Math.cos(rad(a.rotateY));
        const k = P / (P - z2);
        pire = Math.max(pire, Math.abs(x2 * k) - 1, Math.abs(y1 * k) - 1);
      }
    expect(pire).toBeLessThanOrEqual(2 * MARGE_INCLINAISON + 1e-9);
  });
});
