/** Stylo (reprise visuelle) : ellipse ajustée d'« entourer », empreinte du crayon posé, contacts sur les boîtes. */
import { describe, expect, it } from "vitest";
import { encombrementEntourer, pointEntourer } from "../../../src/briques/stylo/courbes";
import { empreinteStylo, polygoneDans, polygoneTouche } from "../../../src/briques/stylo/empreinte";
import { stylo } from "../../../src/briques/stylo/registre";

const CIBLES = [
  { x: 100, y: 200, largeur: 700, hauteur: 90 },
  { x: 100, y: 200, largeur: 300, hauteur: 180 },
  { x: 50, y: 50, largeur: 650, hauteur: 420 },
  { x: 0, y: 0, largeur: 120, hauteur: 70 },
];

describe("entourer : ellipse ajustée", () => {
  it.each(CIBLES)("ne mord jamais sur la cible %o, reste dans son encombrement, déborde peu", (c) => {
    const enc = encombrementEntourer(c, 4);
    for (let i = 0; i <= 400; i++) {
      const q = pointEntourer(c, i / 400);
      expect(q.x > c.x && q.x < c.x + c.largeur && q.y > c.y && q.y < c.y + c.hauteur).toBe(false);
      expect(q.x).toBeGreaterThanOrEqual(enc.x);
      expect(q.x).toBeLessThanOrEqual(enc.x + enc.largeur);
      expect(q.y).toBeGreaterThanOrEqual(enc.y);
      expect(q.y).toBeLessThanOrEqual(enc.y + enc.hauteur);
    }
    // Petite marge : jamais plus de 80 px de chaque côté (une ellipse ordinaire déborderait de 41 % de la largeur).
    expect(c.x - enc.x).toBeLessThan(80);
    expect(c.y - enc.y).toBeLessThan(80);
  });
});

describe("empreinte du crayon", () => {
  const s = stylo("crayon/1");

  it("la pointe est un sommet ; sans la pointe, le corps commence plus loin", () => {
    const p = { x: 400, y: 400 };
    const tout = empreinteStylo(s, p, 300, s.angle);
    const corps = empreinteStylo(s, p, 300, s.angle, true);
    expect(tout).toHaveLength(5);
    expect(corps).toHaveLength(4);
    expect(tout.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1e-9)).toBe(true);
    expect(Math.min(...corps.map((q) => Math.hypot(q.x - p.x, q.y - p.y)))).toBeGreaterThan(40);
  });

  it("contact et inclusion sur des boîtes", () => {
    const poly = empreinteStylo(s, { x: 400, y: 400 }, 300, 145);
    expect(polygoneTouche(poly, { x: 380, y: 300, largeur: 100, hauteur: 90 })).toBe(false); // au-dessus : jamais caché
    expect(polygoneTouche(poly, { x: 450, y: 450, largeur: 100, hauteur: 100 })).toBe(true); // en bas à droite : couvert
    expect(polygoneDans(poly, { x: 0, y: 0, largeur: 1080, hauteur: 1920 })).toBe(true);
    expect(polygoneDans(empreinteStylo(s, { x: 1000, y: 400 }, 300, 145), { x: 0, y: 0, largeur: 1080, hauteur: 1920 })).toBe(false);
  });
});
