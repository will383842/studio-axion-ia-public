/** X1-03 — fenêtre inclinée en 3D (CSS) : angle borné, 0° en tenue, texte lisible après projection, jamais devant le visage, aucune bibliothèque 3D. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { ANGLE_MAX, FenetreInclineeVue, HAUTEUR_TEXTE_MIN_POURCENT, angleFenetre, hauteurApparente, positionPermise, styleInclinaison } from "../../src/briques/motion/petits-objets/fenetre-inclinee";
import { DUREES } from "../../src/briques/motion/jetons";
import { POSITIONS } from "../../src/briques/plan-scenes/zones";
import { OBJET_FENETRE_APP } from "../../src/briques/motion/petits-objets/fenetre-app";

const FPS = 25;
const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");

describe("X1-03 angle au temps", () => {
  it("borné à 20° pour toute entrée, y compris absurde", () => {
    expect(ANGLE_MAX).toBeLessThanOrEqual(20);
    for (const t of [-5, 0, 0.1, 0.2, DUREES.entree / 2, 10, NaN, Infinity, -Infinity])
      for (const s of [1, -1]) {
        const a = angleFenetre(t, { sens: s });
        expect(Math.abs(a.rotateX)).toBeLessThanOrEqual(20);
        expect(Math.abs(a.rotateY)).toBeLessThanOrEqual(20);
      }
  });
  it("0° en tenue : redressé dès DUREES.entree", () => {
    for (const t of [DUREES.entree, DUREES.entree + 0.01, 1, 5]) expect(angleFenetre(t)).toEqual({ rotateX: 0, rotateY: 0 });
    const a0 = angleFenetre(0);
    expect(Math.abs(a0.rotateX) + Math.abs(a0.rotateY)).toBeGreaterThan(0);
  });
  it("décroît sans remonter vers 0", () => {
    let prec = Infinity;
    for (let i = 0; i <= 30; i++) {
      const a = angleFenetre((i / 30) * DUREES.entree);
      const n = Math.hypot(a.rotateX, a.rotateY);
      expect(n).toBeLessThanOrEqual(prec + 1e-9);
      prec = n;
    }
  });
  it("même entrée = même sortie", () => {
    expect(angleFenetre(0.13, { sens: -1 })).toEqual(angleFenetre(0.13, { sens: -1 }));
  });
});

describe("X1-03 lisibilité après projection", () => {
  it("hauteur apparente du plus petit texte ≥ 3 % au pire angle (texte de 4 % du cadre)", () => {
    expect(HAUTEUR_TEXTE_MIN_POURCENT).toBeGreaterThanOrEqual(3);
    for (let i = 0; i <= 40; i++) {
      const a = angleFenetre((i / 40) * DUREES.entree);
      expect(hauteurApparente(4, a, 60)).toBeGreaterThanOrEqual(3);
    }
    expect(hauteurApparente(4, { rotateX: 0, rotateY: 0 }, 60)).toBeCloseTo(4, 9);
  });
  it("jamais plus grand que l'original et décroît avec l'angle", () => {
    expect(hauteurApparente(4, { rotateX: 20, rotateY: 0 }, 60)).toBeLessThan(4);
    expect(hauteurApparente(4, { rotateX: 20, rotateY: 0 }, 60)).toBeLessThan(hauteurApparente(4, { rotateX: 10, rotateY: 0 }, 60));
  });
});

describe("X1-03 visage et rendu", () => {
  it("position jamais devant le visage", () => {
    const permises = POSITIONS.filter((p) => positionPermise(p));
    expect(permises.length).toBeGreaterThan(0);
    expect(positionPermise("centre")).toBe(false);
    expect(positionPermise("plein")).toBe(false);
    expect(positionPermise("bas")).toBe(true);
  });
  it("style CSS : perspective + rotateX/rotateY seulement, 0° en tenue", () => {
    const s = styleInclinaison({ rotateX: 12, rotateY: -8 });
    expect(s.perspective).toMatch(/px$/);
    expect(s.transform).toBe("rotateX(12deg) rotateY(-8deg)");
    expect(styleInclinaison({ rotateX: 0, rotateY: 0 }).transform).toBe("rotateX(0deg) rotateY(0deg)");
  });
  it("enveloppe C9-18 : la vue enveloppe la fenêtre d'application", () => {
    const html = renderToStaticMarkup(
      createElement(FenetreInclineeVue, { image: 0, fps: FPS, dureeImages: 60, fond: "ivoire", graine: 3, parametres: { largeur: 60, hauteur: 50, titre: "Mon espace" } }),
    );
    expect(html).toContain("perspective");
    expect(html).toContain("rotateX(");
    expect(html).toContain("<svg");
    const tenue = renderToStaticMarkup(
      createElement(FenetreInclineeVue, { image: 50, fps: FPS, dureeImages: 60, fond: "ivoire", graine: 3, parametres: { largeur: 60, hauteur: 50 } }),
    );
    expect(tenue).toContain("rotateX(0deg) rotateY(0deg)");
    expect(OBJET_FENETRE_APP.id).toBe("objet-fenetre-app");
  });
});

describe("X1-03 FIX : un instant où la fenêtre est inclinée ET remplie", () => {
  const props = (image: number) => ({ image, fps: FPS, dureeImages: 75, fond: "ivoire" as const, graine: 3, parametres: { largeur: 60, hauteur: 50, titre: "Mon espace" } });
  const rotX = (html: string): number => Number(/rotateX\((-?[\d.]+)deg\)/.exec(html)?.[1] ?? NaN);
  const rempli = (html: string): boolean => html.includes("Mon espace") && [...html.matchAll(/fill-opacity="([\d.]+)"/g)].some((m) => Number(m[1]) > 0);
  it("il existe une image où rotateX > 0 et où le titre et un bloc ont fill-opacity > 0", () => {
    const images = Array.from({ length: 76 }, (_, i) => i);
    const bons = images.filter((i) => {
      const html = renderToStaticMarkup(createElement(FenetreInclineeVue, props(i)));
      return rotX(html) > 0 && rempli(html);
    });
    expect(bons.length).toBeGreaterThan(0);
  });
  it("à la fin : 0° et contenu complet ; perspective relative au cadre", () => {
    const html = renderToStaticMarkup(createElement(FenetreInclineeVue, props(70)));
    expect(rotX(html)).toBe(0);
    expect(rempli(html)).toBe(true);
    expect(html).toMatch(/perspective:\d+cqh/);
  });
});

describe("X1-03 éteint et garde", () => {
  const SOURCES = ["src/briques/motion/petits-objets/fenetre-inclinee.ts", "studio-rendu/compositions/petits-objets/FenetreInclinee.tsx"];
  it("aucune bibliothèque 3D, aucun hasard, aucune horloge, aucun cubic-bezier", () => {
    for (const f of SOURCES) {
      const src = lire(f);
      expect(src).not.toMatch(/from\s+["'](three|@react-three|babylonjs|@babylonjs|cannon|ogl|regl)[^"']*["']/);
      expect(src).not.toMatch(/Math\.random|Date\.now|performance\.now|cubic-bezier/);
    }
  });
  it("non inscrit : rien dans src/ ni studio-rendu/ n'importe ces fichiers, registre et porte intacts", () => {
    const tous = lire("src/briques/motion/petits-objets/index.ts");
    expect(tous).not.toMatch(/fenetre-inclinee|FenetreInclinee/);
    expect(lire("studio-rendu/compositions/petits-objets/CalqueObjet.tsx")).not.toMatch(/FenetreInclinee/);
  });
});
