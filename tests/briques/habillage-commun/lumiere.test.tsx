import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ANGLE_REFLET,
  FuiteLumiere,
  RefletBalayage,
  dureeFuiteImages,
  halo,
  intensiteFuite,
  lueurTexte,
  positionBalayage,
  type CoteFuite,
  type ParametresFuite,
} from "@/briques/motion/habillage-commun/lumiere";
import { CHARTE_AXION, TEINTES_INTERDITES, type FondAxion } from "@/briques/jetons-motion";
import { ZONE_VISAGE } from "@/briques/plan-scenes/zones";

const FPS = 25;
const COTES: CoteFuite[] = ["gauche", "droite", "haut"];
const FONDS: FondAxion[] = ["noir", "ivoire"];
const params = (cote: CoteFuite, fond: FondAxion, dureeImages = 25, eviterVisage = true): ParametresFuite => ({ fps: FPS, dureeImages, fond, cote, eviterVisage });
const rendu = (image: number, p: ParametresFuite) => renderToStaticMarkup(<FuiteLumiere image={image} largeur={1080} hauteur={1920} {...p} />);

describe("lumiere : fuite", () => {
  it("visage : aucune valeur > 0,05 dans ZONE_VISAGE au pic (grille 20 × 20), 3 côtés, 2 fonds", () => {
    for (const cote of COTES)
      for (const fond of FONDS) {
        const p = params(cote, fond);
        for (let i = 0; i < 20; i++)
          for (let j = 0; j < 20; j++) {
            const x = ZONE_VISAGE.x + ((i + 0.5) / 20) * ZONE_VISAGE.largeur;
            const y = ZONE_VISAGE.y + ((j + 0.5) / 20) * ZONE_VISAGE.hauteur;
            expect(intensiteFuite(x, y, 12, p)).toBeLessThanOrEqual(0.05);
          }
      }
  });

  it("la fuite est bien visible au bord (la mesure n'est pas nulle partout)", () => {
    expect(intensiteFuite(2, 30, 12, params("gauche", "noir"))).toBeGreaterThan(0.3);
  });

  it("le dessin concorde avec intensiteFuite (5 points)", () => {
    const p = params("gauche", "noir", 25, false);
    const html = rendu(12, p);
    const couches = [...html.matchAll(/data-cx="([\d.]+)" data-cy="([\d.]+)" data-rx="([\d.]+)" data-ry="([\d.]+)" data-opacite="([\d.]+)"/g)].map((m) => m.slice(1).map(Number));
    expect(couches.length).toBeGreaterThanOrEqual(2);
    expect(couches.length).toBeLessThanOrEqual(3);
    for (const [x, y] of [[0, 30], [5, 60], [10, 20], [20, 88], [50, 50]]) {
      let s = 0;
      for (const [cx, cy, rx, ry, op] of couches) s += op * Math.max(0, 1 - Math.hypot((x - cx) / rx, (y - cy) / ry));
      expect(Math.min(1, s)).toBeCloseTo(intensiteFuite(x, y, 12, p), 2);
    }
  });

  it("durée bornée : 5 → 15 images, 100 → 30 images ; rien avant 0 ni après la fin", () => {
    expect(dureeFuiteImages(5, FPS)).toBe(15);
    expect(dureeFuiteImages(100, FPS)).toBe(30);
    for (const [d, n] of [[5, 15], [100, 30]]) {
      const p = params("gauche", "noir", d);
      expect(rendu(-1, p)).toBe("");
      expect(rendu(n, p)).toBe("");
      expect(rendu(Math.floor(n / 2), p)).not.toBe("");
      expect(intensiteFuite(2, 30, -1, p)).toBe(0);
      expect(intensiteFuite(2, 30, n, p)).toBe(0);
    }
  });

  it("couleurs : toutes dans la charte, pas d'orange sur ivoire, aucune teinte interdite", () => {
    const permises = Object.values(CHARTE_AXION).map((h) => {
      const n = parseInt(h.slice(1), 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, `;
    });
    const [ivoire, , , terracotta, orange] = permises;
    for (const cote of COTES)
      for (const fond of FONDS) {
        const html = rendu(12, params(cote, fond));
        const trouvees = [...html.matchAll(/rgba\(\d+, \d+, \d+, /g)].map((m) => m[0]);
        expect(trouvees.length).toBeGreaterThan(0);
        for (const c of trouvees) expect(permises).toContain(c);
        if (fond === "ivoire") expect(html).not.toContain(orange);
        else expect(html).toContain(orange);
        expect(html).toContain(fond === "ivoire" ? terracotta : ivoire);
        for (const t of TEINTES_INTERDITES) expect(html.toLowerCase()).not.toContain(t);
        expect(html).toContain("mix-blend-mode:screen");
        expect(html).not.toContain("filter");
      }
  });

  it("déterministe", () => {
    expect(rendu(9, params("droite", "noir"))).toBe(rendu(9, params("droite", "noir")));
  });
});

describe("lumiere : reflet", () => {
  const boite = { largeur: 600, hauteur: 300 };
  it("confiné à la boîte, 18°, bande hors boîte à t = 0 et t = 1", () => {
    const html = renderToStaticMarkup(<RefletBalayage image={10} dureeImages={20} boite={boite} fond="noir" />);
    expect(html).toContain("overflow:hidden");
    expect(html).toContain(`rotate(${ANGLE_REFLET}deg)`);
    expect(ANGLE_REFLET).toBe(18);
    const debut = positionBalayage(0, boite);
    const fin = positionBalayage(1, boite);
    expect(debut.centreX + debut.demiEtendue).toBeLessThanOrEqual(0);
    expect(fin.centreX - fin.demiEtendue).toBeGreaterThanOrEqual(boite.largeur);
    const milieu = positionBalayage(0.5, boite);
    expect(milieu.centreX).toBeGreaterThan(0);
    expect(milieu.centreX).toBeLessThan(boite.largeur);
  });
  it("déterministe", () => {
    const a = () => renderToStaticMarkup(<RefletBalayage image={7} dureeImages={20} boite={boite} fond="ivoire" />);
    expect(a()).toBe(a());
  });
});

describe("lumiere : lueur de texte et halo", () => {
  it("lueurTexte : au plus 3 ombres, plafonnée, force 0 = « none »", () => {
    for (const f of [0.1, 0.5, 1, 5]) expect(lueurTexte(CHARTE_AXION.orange, f).split("), ").length).toBeLessThanOrEqual(3);
    expect(lueurTexte(CHARTE_AXION.orange, 5)).toBe(lueurTexte(CHARTE_AXION.orange, 1));
    expect(lueurTexte(CHARTE_AXION.orange, -2)).toBe("none");
    expect(lueurTexte(CHARTE_AXION.orange, 0)).toBe("none");
    expect(lueurTexte(CHARTE_AXION.orange, NaN)).toBe("none");
    const rayons = [...lueurTexte(CHARTE_AXION.orange, 1).matchAll(/0 0 (\d+)px/g)].map((m) => Number(m[1]));
    expect(Math.max(...rayons)).toBeLessThanOrEqual(18);
  });
  it("halo : aucun filtre, plafonné, force 0 = none", () => {
    const b = { largeur: 4000, hauteur: 3000 };
    const h = halo(b, CHARTE_AXION.terracotta, 1);
    expect(JSON.stringify(h)).not.toContain("filter");
    expect(halo(b, CHARTE_AXION.terracotta, 9)).toEqual(h);
    expect(halo(b, CHARTE_AXION.terracotta, 0)).toEqual({ boxShadow: "none" });
    for (const m of String(h.boxShadow).matchAll(/0 0 (\d+)px (\d+)px/g)) expect(Number(m[1])).toBeLessThanOrEqual(48);
  });
});

describe("lumiere : source", () => {
  const src = readFileSync(join(__dirname, "../../../src/briques/motion/habillage-commun/lumiere.tsx"), "utf8");
  it("aucun @/, Math.random, blur(, hook, Remotion", () => {
    expect(src).not.toMatch(/@\/|Math\.random|blur\(|useCurrentFrame|from "remotion"|\buse[A-Z]\w*\(/);
  });
});
