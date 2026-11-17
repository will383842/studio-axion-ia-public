/** C6-H18 — IconeAnimee : pure, déterministe, couleurs de la charte (via le ton), aucun consommateur. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { IconeAnimee, type AnimationIcone } from "../../../src/briques/motion/bibliotheque-icones/IconeAnimee";
import { PALETTE } from "../../../src/briques/charte/axion-2026";
import type { TonObjet } from "../../../src/briques/motion/petits-objets/contrat";

const ANIMATIONS: AnimationIcone[] = ["trace", "rebond", "rotation", "halo", "cascade", "masque", "jauge", "pulsation", "duotone-remplissage"];
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS = ["ivoire", "noir"] as const;
const FPS = 25;
const DERNIERE = 40;

const rendre = (o: { nom?: string; image: number; animation: AnimationIcone; ton?: TonObjet; fond?: "ivoire" | "noir" }) =>
  renderToStaticMarkup(createElement(IconeAnimee, { nom: (o.nom ?? "lucide:coche") as never, image: o.image, fps: FPS, animation: o.animation, ton: o.ton ?? "neutre", fond: o.fond ?? "ivoire", taille: 96 }));
const decalages = (h: string) => [...h.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((m) => Number(m[1]));
const opacitesRemplissage = (h: string) => [...h.matchAll(/fill-opacity="([^"]+)"/g)].map((m) => Number(m[1]));

describe("C6-H18 IconeAnimee", () => {
  const attr = (h: string, nomAttr: string, balise: string) => {
    const m = h.match(new RegExp(`<${balise}[^>]*?${nomAttr}="([^"]+)"`));
    return m ? Number(m[1]) : Number.NaN;
  };
  const echelle = (h: string) => Number(h.match(/scale\(([^)]+)\)/)![1]);
  const angle = (h: string) => Number(h.match(/rotate\(([^)]+)\)/)![1]);
  const zone = (h: string, g: string) => h.match(new RegExp(`<rect data-zone="${g}"[^>]*?width="([^"]+)"[^>]*?height="([^"]+)"`))!.slice(1).map(Number);
  const MILIEU = 5; // image 5 à 25 i/s = 0,2 s

  it("tracé : image 0 à 0, dernière image complète, milieu entre les deux", () => {
    expect(decalages(rendre({ image: 0, animation: "trace", nom: "lucide:croix" })).every((x) => x === 1)).toBe(true);
    expect(decalages(rendre({ image: DERNIERE, animation: "trace", nom: "lucide:croix" })).every((x) => x === 0)).toBe(true);
    const m = decalages(rendre({ image: MILIEU, animation: "trace", nom: "lucide:croix" }));
    expect(m.every((x) => x > 0 && x < 1)).toBe(true);
  });

  it("rebond : 0 à l'image 0, dépasse 1 au milieu, revient à 1 à la fin", () => {
    expect(echelle(rendre({ image: 0, animation: "rebond" }))).toBe(0);
    const valeurs = Array.from({ length: DERNIERE + 1 }, (_, i) => echelle(rendre({ image: i, animation: "rebond" })));
    expect(Math.max(...valeurs)).toBeGreaterThan(1);
    expect(Math.max(...valeurs)).toBeCloseTo(1.15, 2);
    expect(valeurs[DERNIERE]).toBe(1);
    const pic = valeurs.indexOf(Math.max(...valeurs));
    expect(pic).toBeGreaterThan(0);
    expect(pic).toBeLessThan(DERNIERE);
    for (let i = pic + 1; i <= DERNIERE; i++) expect(valeurs[i]).toBeLessThanOrEqual(valeurs[i - 1] + 1e-9);
  });

  it("rotation : 0° à l'image 0, 360° à la fin, croissante entre les deux", () => {
    expect(angle(rendre({ image: 0, animation: "rotation" }))).toBe(0);
    expect(angle(rendre({ image: DERNIERE, animation: "rotation" }))).toBe(360);
    const m = angle(rendre({ image: MILIEU, animation: "rotation" }));
    expect(m).toBeGreaterThan(0);
    expect(m).toBeLessThan(360);
    expect(angle(rendre({ image: MILIEU + 2, animation: "rotation" }))).toBeGreaterThan(m);
  });

  it("halo : opacité 0 au début et à la fin, positive au milieu (≤ 0,5), rayon croissant, aucun filtre", () => {
    const h = (i: number) => rendre({ image: i, animation: "halo" });
    expect(attr(h(0), "opacity", "circle data-halo=\"1\"[^>]*?")).toBe(0);
    expect(attr(h(DERNIERE), "opacity", "circle data-halo=\"1\"[^>]*?")).toBe(0);
    const o = attr(h(6), "opacity", "circle data-halo=\"1\"[^>]*?");
    expect(o).toBeGreaterThan(0);
    expect(o).toBeLessThanOrEqual(0.5);
    expect(attr(h(10), "r", "circle data-halo=\"1\"[^>]*?")).toBeGreaterThan(attr(h(0), "r", "circle data-halo=\"1\"[^>]*?"));
    expect(h(6)).not.toMatch(/filter/);
  });

  it("cascade : le nœud n démarre 4 images après le nœud n-1 ; tout est tracé à la fin", () => {
    const d = (i: number) => decalages(rendre({ image: i, animation: "cascade", nom: "lucide:croix" }));
    expect(d(0).every((x) => x === 1)).toBe(true);
    expect(d(DERNIERE).every((x) => x === 0)).toBe(true);
    for (let i = 0; i <= 20; i++) expect(d(i)[1]).toBeCloseTo(i < 4 ? 1 : d(i - 4)[0], 9);
    expect(d(4)[0]).toBeLessThan(1);
    expect(d(4)[1]).toBe(1);
    expect(d(5)[1]).toBeLessThan(1);
  });

  it("masque : étendue 0 à l'image 0, pleine largeur à la fin, croissante, sans filtre", () => {
    const l = (i: number) => zone(rendre({ image: i, animation: "masque" }), "masque")[0];
    const largeur = l(DERNIERE);
    expect(largeur).toBe(24);
    expect(l(0)).toBe(0);
    expect(l(MILIEU)).toBeGreaterThan(0);
    expect(l(MILIEU)).toBeLessThan(largeur);
    expect(l(MILIEU + 1)).toBeGreaterThan(l(MILIEU));
    expect(rendre({ image: MILIEU, animation: "masque" })).not.toMatch(/filter/);
  });

  it("jauge : niveau 0 à l'image 0, plein à la fin, linéaire entre les deux", () => {
    const h = (i: number) => zone(rendre({ image: i, animation: "jauge" }), "jauge")[1];
    expect(h(0)).toBe(0);
    expect(h(DERNIERE)).toBe(24);
    const total = 12.5; // 0,5 s à 25 i/s
    expect(h(6.25)).toBeCloseTo(12, 6);
    expect(h(3)).toBeCloseTo(24 * (3 / total), 6);
  });

  it("duotone-remplissage : remplissage 0 à l'image 0, tracé complet à la fin", () => {
    const duo = opacitesRemplissage(rendre({ image: 0, animation: "duotone-remplissage" }));
    expect(duo.length).toBeGreaterThan(0);
    expect(duo.every((o) => o === 0)).toBe(true);
    const d0 = decalages(rendre({ image: 0, animation: "duotone-remplissage", nom: "lucide:croix" }));
    expect(d0.length).toBeGreaterThan(0);
    expect(d0.every((x) => x === 1)).toBe(true);
    expect(decalages(rendre({ image: DERNIERE, animation: "duotone-remplissage", nom: "lucide:croix" })).every((x) => x === 0)).toBe(true);
  });

  it("pulsation : échelle 1 à l'image 0, au-dessus de 1 en cours de période, périodique", () => {
    const e = (i: number) => echelle(rendre({ image: i, animation: "pulsation" }));
    expect(e(0)).toBe(1);
    const pic = Math.max(...Array.from({ length: 60 }, (_, i) => e(i)));
    expect(pic).toBeGreaterThan(1);
    expect(e(MILIEU)).toBeGreaterThanOrEqual(1);
  });

  it("autres types de nœuds (circle, rect) tracés avec les mêmes règles", () => {
    const h = rendre({ image: 3, animation: "trace", nom: "lucide:coche-cercle" });
    expect(h).toContain("<circle");
    expect(h).toContain('pathLength="1"');
    expect(h).not.toMatch(/filter/);
  });

  it("déterminisme : même entrée, même rendu", () => {
    for (const a of ANIMATIONS) for (const i of [0, 3, 9, 40, 77]) expect(rendre({ image: i, animation: a })).toBe(rendre({ image: i, animation: a }));
  });

  it("couleurs ∈ charte pour chaque animation, ton et fond ; orange jamais sur ivoire", () => {
    const charte = new Set(Object.values(PALETTE).map((c) => c.toLowerCase()));
    for (const a of ANIMATIONS) for (const t of TONS) for (const f of FONDS) {
      const h = rendre({ image: 10, animation: a, ton: t, fond: f });
      const couleurs = [...h.matchAll(/(?:stroke|fill)="(#[0-9a-fA-F]{3,8})"/g)].map((m) => m[1].toLowerCase());
      expect(couleurs.length).toBeGreaterThan(0);
      for (const c of couleurs) expect(charte.has(c)).toBe(true);
      if (f === "ivoire") expect(h.toLowerCase()).not.toContain(PALETTE.orange.toLowerCase());
    }
    expect(rendre({ image: 10, animation: "trace", ton: "accent", fond: "noir" }).toLowerCase()).toContain(PALETTE.orange.toLowerCase());
  });

  it("jamais d'exception sur entrée aberrante", () => {
    expect(() => rendre({ image: Number.NaN, animation: "trace" })).not.toThrow();
    expect(() => rendre({ image: -5, animation: "rebond" })).not.toThrow();
    expect(() => rendre({ nom: "inconnu", image: 5, animation: "trace" })).not.toThrow();
  });

  it("fichier : pur, sans @/, droits, useCurrentFrame, remotion, Math.random, Lottie, framer-motion, courbe en dur", () => {
    const src = readFileSync(new URL("../../../src/briques/motion/bibliotheque-icones/IconeAnimee.tsx", import.meta.url), "utf8");
    for (const interdit of [/from\s+["']@\//, /droits/, /useCurrentFrame/, /remotion/, /Math\.random/, /from\s+["'][^"']*lottie/i, /require\(/, /framer-motion/, /cubic-bezier\(/, /Easing\.bezier\(/, /(damping|stiffness|mass)\s*:\s*\d/]) {
      expect(src).not.toMatch(interdit);
    }
    expect(src).toContain("Aucun consommateur");
  });
});
