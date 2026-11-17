/** C6-H18 — IconeAnimee : pure, déterministe, couleurs de la charte (via le ton), aucun consommateur. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { IconeAnimee, type AnimationIcone } from "../../../src/briques/motion/bibliotheque-icones/IconeAnimee";
import { PALETTE } from "../../../src/briques/charte/axion-2026";
import type { TonObjet } from "../../../src/briques/motion/petits-objets/contrat";

const ANIMATIONS: AnimationIcone[] = ["trace", "pop", "coche-dessinee", "croix-barre", "fleche-pousse", "pulsation", "duotone-remplissage"];
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS = ["ivoire", "noir"] as const;
const FPS = 25;
const DERNIERE = 40;

const rendre = (o: { nom?: string; image: number; animation: AnimationIcone; ton?: TonObjet; fond?: "ivoire" | "noir" }) =>
  renderToStaticMarkup(createElement(IconeAnimee, { nom: (o.nom ?? "lucide:coche") as never, image: o.image, fps: FPS, animation: o.animation, ton: o.ton ?? "neutre", fond: o.fond ?? "ivoire", taille: 96 }));
const decalages = (h: string) => [...h.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((m) => Number(m[1]));
const opacites = (h: string) => [...h.matchAll(/ opacity="([^"]+)"/g)].map((m) => Number(m[1]));
const opacitesRemplissage = (h: string) => [...h.matchAll(/fill-opacity="([^"]+)"/g)].map((m) => Number(m[1]));

describe("C6-H18 IconeAnimee", () => {
  it("image 0 : tracé à 0 ou objet invisible", () => {
    for (const a of ["trace", "coche-dessinee", "croix-barre", "duotone-remplissage"] as const) {
      const d = decalages(rendre({ image: 0, animation: a, nom: "lucide:croix" }));
      expect(d.length).toBeGreaterThan(0);
      expect(d.every((x) => x === 1)).toBe(true);
    }
    expect(opacites(rendre({ image: 0, animation: "pop" })).every((o) => o === 0)).toBe(true);
    const duo = opacitesRemplissage(rendre({ image: 0, animation: "duotone-remplissage" }));
    expect(duo.length).toBeGreaterThan(0);
    expect(duo.every((o) => o === 0)).toBe(true);
  });

  it("dernière image : complète", () => {
    for (const a of ["trace", "coche-dessinee", "croix-barre", "duotone-remplissage"] as const) {
      expect(decalages(rendre({ image: DERNIERE, animation: a, nom: "lucide:croix" })).every((x) => x === 0)).toBe(true);
    }
    expect(opacites(rendre({ image: DERNIERE, animation: "pop" })).every((o) => o === 1)).toBe(true);
    expect(decalages(rendre({ image: DERNIERE, animation: "fleche-pousse", nom: "lucide:fleche-bas" })).every((x) => x === 0)).toBe(true);
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

  it("croix-barre : le 2e trait commence 4 images après le 1er", () => {
    const d = (i: number) => decalages(rendre({ image: i, animation: "croix-barre", nom: "lucide:croix" }));
    for (let i = 0; i <= 20; i++) expect(d(i)[1]).toBeCloseTo(i < 4 ? 1 : d(i - 4)[0], 9);
    expect(d(4)[0]).toBeLessThan(1);
    expect(d(4)[1]).toBe(1);
    expect(d(5)[1]).toBeLessThan(1);
  });

  it("jamais d'exception sur entrée aberrante", () => {
    expect(() => rendre({ image: Number.NaN, animation: "trace" })).not.toThrow();
    expect(() => rendre({ image: -5, animation: "pop" })).not.toThrow();
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
