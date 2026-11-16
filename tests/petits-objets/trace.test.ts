/** C9-02 — tracé pur, phases d'un objet, copies de formes identiques aux originaux. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { cheminCercleObjet, cheminFlecheObjet, TraceSvg } from "../../src/briques/motion/petits-objets/TraceSvg";
import { IMAGES_ENTREE, IMAGES_SORTIE, phaseObjet } from "../../src/briques/motion/petits-objets/progres";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import type { TonObjet } from "../../src/briques/motion/petits-objets/contrat";

/**
 * Les formes d'origine sont lues dans le source de MotionCaptureAnnotee.tsx (pointCercle, cheminCercle, cheminFleche)
 * puis exécutées telles quelles : on n'importe pas le module, qui tire `remotion` (absent du `node_modules` racine
 * en CI) et ferait entrer studio-rendu dans le contrôle de types racine.
 */
function formesOrigine() {
  const source = readFileSync(new URL("../../studio-rendu/compositions/commune/motion/MotionCaptureAnnotee.tsx", import.meta.url), "utf8");
  const debut = source.indexOf("export function pointCercle");
  const fin = source.indexOf("/** Position de l'étiquette");
  if (debut < 0 || fin <= debut) throw new Error("formes d'origine introuvables dans MotionCaptureAnnotee.tsx");
  const js = transformSync(source.slice(debut, fin).replace(/export function/g, "function"), { loader: "ts" }).code;
  return new Function(`${js}\nreturn { cheminCercle, cheminFleche };`)() as {
    cheminCercle: (x: number, y: number, l: number, h: number, graine?: number) => string;
    cheminFleche: (x: number, y: number, l: number, h: number, W: number, H: number) => unknown;
  };
}
const { cheminCercle, cheminFleche } = formesOrigine();

const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const JEUX: [number, number, number, number, number][] = [
  [100, 200, 300, 80, 0],
  [10, 900, 120, 60, 1.7],
  [640, 40, 500, 400, 3.1],
];

describe("C9-02 formes copiées = formes d'origine", () => {
  it("cercle", () => {
    for (const [x, y, l, h, g] of JEUX) expect(cheminCercleObjet(x, y, l, h, g)).toBe(cheminCercle(x, y, l, h, g));
  });
  it("flèche", () => {
    for (const [x, y, l, h] of JEUX) expect(cheminFlecheObjet(x, y, l, h, 1080, 1920)).toEqual(cheminFleche(x, y, l, h, 1080, 1920));
  });
});

describe("C9-02 phaseObjet", () => {
  const D = 60;
  it("0 avant le début", () => expect(phaseObjet(-1, D)).toEqual({ trace: 0, opacite: 0 }));
  it("entrée : tracé croissant jusqu'à 1", () => {
    expect(phaseObjet(0, D).trace).toBe(0);
    expect(phaseObjet(IMAGES_ENTREE + 2, D).trace).toBe(1);
  });
  it("1 en tenue", () => expect(phaseObjet(30, D)).toEqual({ trace: 1, opacite: 1 }));
  it("0 à la dernière image", () => expect(phaseObjet(D - 1, D).opacite).toBe(0));
  it("sortie en 6 images exactement", () => {
    const sous = Array.from({ length: D }, (_, i) => i).filter((i) => phaseObjet(i, D).opacite < 1);
    expect(IMAGES_SORTIE).toBe(6);
    expect(sous).toEqual([54, 55, 56, 57, 58, 59]);
  });
  it("borné et sans exception sur 2 000 images, y compris valeurs absurdes", () => {
    for (let i = -50; i < 2000; i++) for (const d of [0, 1, 5, 60, 2000]) {
      const p = phaseObjet(i, d);
      expect(p.trace).toBeGreaterThanOrEqual(0);
      expect(p.trace).toBeLessThanOrEqual(1);
      expect(p.opacite).toBeGreaterThanOrEqual(0);
      expect(p.opacite).toBeLessThanOrEqual(1);
    }
    expect(phaseObjet(NaN, 60)).toEqual({ trace: 0, opacite: 0 });
    expect(phaseObjet(3, Infinity)).toEqual({ trace: 0, opacite: 0 });
  });
});

describe("C9-02 TraceSvg", () => {
  const rendre = (t: number, ton: TonObjet, fond: "ivoire" | "noir") => renderToStaticMarkup(createElement("svg", null, createElement(TraceSvg, { d: "M 0 0 L 10 10", t, ton, fond })));
  it("pathLength=1, aucun filtre, couleur de la charte", () => {
    for (const fond of ["ivoire", "noir"] as const) for (const ton of TONS) {
      const m = rendre(0.5, ton, fond);
      expect(m).toContain('pathLength="1"');
      expect(m).toContain('stroke-dashoffset="0.5"');
      expect(m).not.toMatch(/filter/i);
      expect(m).toContain(`stroke="${couleurDuTon(ton, fond)}"`);
    }
  });
  it("même entrée = même balisage", () => expect(rendre(0.3, "accent", "noir")).toBe(rendre(0.3, "accent", "noir")));
});
