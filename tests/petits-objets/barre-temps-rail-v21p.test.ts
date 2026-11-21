/**
 * FIX-X1-16-b-v21p — la composition BarreTemps dessine son rail (derrière la barre).
 * Chemin CALCULÉ vers studio-rendu/compositions/** (PIEGE-REMOTION-TSC.md) ; `remotion` (déclaré dans studio-rendu seulement) est remplacé par un faux.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { barreTemps } from "../../src/briques/motion/petits-objets/barre-temps";

const etat = { image: 0, duree: 100 };
vi.mock("remotion", () => ({
  AbsoluteFill: (p: { style?: object; children?: unknown }) => createElement("div", { "data-fill": "1", style: p.style }, p.children as never),
  useCurrentFrame: () => etat.image,
  useVideoConfig: () => ({ durationInFrames: etat.duree }),
}));

type Props = { zone: { haut: number; droite: number; bas: number; gauche: number }; fond: "ivoire" | "noir"; dureeImages?: number };
let BarreTemps: (p: Props) => unknown;
const CHEMIN = ["..", "..", "studio-rendu", "compositions", "petits-objets", "BarreTemps"].join("/");
beforeAll(async () => {
  BarreTemps = ((await import(/* @vite-ignore */ CHEMIN)) as { BarreTemps: typeof BarreTemps }).BarreTemps;
});
beforeEach(() => { etat.image = 50; etat.duree = 100; });

const ZONE = { haut: 0, droite: 10, bas: 8, gauche: 6 };
const rendre = (p: Partial<Props> = {}) => renderToStaticMarkup(createElement(BarreTemps as never, { zone: ZONE, fond: "ivoire", ...p }));
const rects = (m: string) => [...m.matchAll(/<div style="([^"]*)"><\/div>/g)].map((x) => {
  const s = x[1];
  const n = (k: string) => Number(new RegExp(`(?:^|;)${k}:([\\d.]+)%`).exec(s)?.[1]);
  return { left: n("left"), top: n("top"), width: n("width"), height: n("height"), bg: /background:([^;]+)/.exec(s)?.[1] };
});

describe("FIX-X1-16-b-v21p (a) deux rectangles, le rail en premier", () => {
  it("(a) 2 rectangles ; le premier est le rail (pleine zone), le second la barre", () => {
    const b = barreTemps({ image: 50, dureeImages: 100, zone: ZONE, fond: "ivoire" });
    const r = rects(rendre());
    expect(r).toHaveLength(2);
    expect(r[0].width).toBeCloseTo(b.rail.boite.largeur);
    expect(r[0].left).toBeCloseTo(b.rail.boite.x);
    expect(r[0].bg).toBe(b.rail.couleur);
    expect(r[1].width).toBeCloseTo(b.boite.largeur);
    expect(r[1].bg).toBe(b.couleur);
  });
  it("(a) rail et barre : même y, même hauteur ; barre incluse dans le rail", () => {
    const [rail, barre] = rects(rendre());
    expect(barre.top).toBe(rail.top);
    expect(barre.height).toBe(rail.height);
    expect(barre.left).toBeGreaterThanOrEqual(rail.left);
    expect(barre.left + barre.width).toBeLessThanOrEqual(rail.left + rail.width + 1e-9);
  });
  it("(a) le rail est indépendant du temps, la barre avance", () => {
    etat.image = 25; const a = rects(rendre());
    etat.image = 75; const c = rects(rendre());
    expect(c[0]).toEqual(a[0]);
    expect(c[1].width).toBeGreaterThan(a[1].width);
  });
  it("(a) 2e appel identique ; fond noir : couleurs du rail et de la barre suivent le fond", () => {
    expect(rendre()).toBe(rendre());
    const [rail, barre] = rects(rendre({ fond: "noir" }));
    const b = barreTemps({ image: 50, dureeImages: 100, zone: ZONE, fond: "noir" });
    expect(rail.bg).toBe(b.rail.couleur);
    expect(barre.bg).toBe(b.couleur);
  });
  it("(a) dureeImages explicite prime sur celle de la vidéo", () => {
    const [, barre] = rects(rendre({ dureeImages: 200 }));
    expect(barre.width).toBeCloseTo(barreTemps({ image: 50, dureeImages: 200, zone: ZONE, fond: "ivoire" }).boite.largeur);
  });
  it("(b) vidéo en cours : image 0 → barre vide, rien dessiné (comportement inchangé) ; zone pleine largeur nulle → rien", () => {
    etat.image = 0;
    expect(rendre()).not.toContain("<div style=\"position:absolute");
    expect(rects(rendre({ zone: { haut: 0, droite: 60, bas: 0, gauche: 60 } }))).toHaveLength(0);
  });
  it("(c) le rail est écrit AVANT la barre dans le fichier (derrière) et le fichier reste éteint : aucun importeur", () => {
    const src = readFileSync("studio-rendu/compositions/petits-objets/BarreTemps.tsx", "utf8");
    expect(src.indexOf("b.rail.boite.x")).toBeGreaterThan(-1);
    expect(src.indexOf("b.rail.boite.x")).toBeLessThan(src.indexOf("b.boite.x"));
    const importeurs = execSync("git grep -l \"petits-objets/BarreTemps\" -- src studio-rendu || true", { encoding: "utf8" }).trim();
    expect(importeurs).toBe("");
  });
});
