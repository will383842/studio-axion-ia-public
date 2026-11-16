import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { captureEcran, ZOOM_MAX, ZOOM_MIN } from "../../src/briques/plan-scenes/tutoriel/capture";

const TOILES = {
  "4:5": { largeur: 1080, hauteur: 1350 },
  "9:16": { largeur: 1080, hauteur: 1920 },
  "1:1": { largeur: 1080, hauteur: 1080 },
};
const SRC = "https://exemple.invalide/capture-signee.png";

describe("captureEcran : repli sans image", () => {
  it("sans src : fenêtre vide neutre et une remarque, aucune exception", () => {
    const c = captureEcran({ toile: TOILES["9:16"] });
    expect(c).not.toBeNull();
    expect(c!.src).toBeNull();
    expect(c!.remarque).toMatch(/image/i);
    expect(c!.zoom).toBe(1);
    expect(c!.curseur).toBeNull();
  });
  it("src vide ou espaces : même repli", () => {
    expect(captureEcran({ src: "   ", toile: TOILES["1:1"] })!.src).toBeNull();
    expect(captureEcran({ src: "", toile: TOILES["1:1"] })!.remarque).toBeTruthy();
  });
  it("toile invalide : null, sans exception", () => {
    expect(captureEcran({ src: SRC, toile: { largeur: 0, hauteur: 100 } })).toBeNull();
    expect(captureEcran({ src: SRC, toile: { largeur: Number.NaN, hauteur: 100 } })).toBeNull();
  });
});

describe("captureEcran : zoom et curseur bornés", () => {
  it("zoom > max : borné", () => {
    expect(captureEcran({ src: SRC, zoom: 99, toile: TOILES["4:5"] })!.zoom).toBe(ZOOM_MAX);
  });
  it("zoom < min, NaN ou absent : borné à 1", () => {
    expect(captureEcran({ src: SRC, zoom: 0.2, toile: TOILES["4:5"] })!.zoom).toBe(ZOOM_MIN);
    expect(captureEcran({ src: SRC, zoom: Number.NaN, toile: TOILES["4:5"] })!.zoom).toBe(1);
    expect(captureEcran({ src: SRC, toile: TOILES["4:5"] })!.zoom).toBe(1);
  });
  it("zoom valide conservé", () => {
    expect(captureEcran({ src: SRC, zoom: 1.5, toile: TOILES["4:5"] })!.zoom).toBe(1.5);
  });
  it("curseur hors image : borné à l'image", () => {
    const c = captureEcran({ src: SRC, curseur: { x: 250, y: -40 }, toile: TOILES["9:16"] })!;
    const im = c.image;
    expect(c.curseur!.x).toBe(im.x + im.largeur);
    expect(c.curseur!.y).toBe(im.y);
  });
  it("curseur dans l'image : position proportionnelle", () => {
    const c = captureEcran({ src: SRC, curseur: { x: 50, y: 50 }, toile: TOILES["1:1"] })!;
    expect(c.curseur!.x).toBeCloseTo(c.image.x + c.image.largeur / 2, 0);
    expect(c.curseur!.y).toBeCloseTo(c.image.y + c.image.hauteur / 2, 0);
  });
  it("curseur NaN : ignoré", () => {
    expect(captureEcran({ src: SRC, curseur: { x: Number.NaN, y: 1 }, toile: TOILES["1:1"] })!.curseur).toBeNull();
  });
});

describe("captureEcran : géométrie dans la toile", () => {
  for (const [nom, toile] of Object.entries(TOILES)) {
    it(`${nom} : fenêtre, barre, image et points dans la toile`, () => {
      const c = captureEcran({ src: SRC, curseur: { x: 30, y: 70 }, zoom: 2, toile })!;
      const f = c.fenetre;
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.x + f.largeur).toBeLessThanOrEqual(toile.largeur);
      expect(f.y + f.hauteur).toBeLessThanOrEqual(toile.hauteur);
      const im = c.image;
      expect(im.x).toBeGreaterThanOrEqual(f.x);
      expect(im.y).toBeGreaterThanOrEqual(f.y + c.barre.hauteur);
      expect(im.x + im.largeur).toBeLessThanOrEqual(f.x + f.largeur);
      expect(im.y + im.hauteur).toBeLessThanOrEqual(f.y + f.hauteur);
      expect(c.barre.points).toHaveLength(3);
      for (const p of c.barre.points) {
        expect(p.cx - p.rayon).toBeGreaterThanOrEqual(f.x);
        expect(p.cx + p.rayon).toBeLessThanOrEqual(f.x + f.largeur);
        expect(p.cy + p.rayon).toBeLessThanOrEqual(f.y + c.barre.hauteur);
      }
      expect(c.curseur!.x).toBeGreaterThanOrEqual(im.x);
      expect(c.curseur!.x).toBeLessThanOrEqual(im.x + im.largeur);
      expect(c.curseur!.y).toBeGreaterThanOrEqual(im.y);
      expect(c.curseur!.y).toBeLessThanOrEqual(im.y + im.hauteur);
    });
  }
  it("déterministe et couleurs = noms de jetons de la charte", () => {
    const a = captureEcran({ src: SRC, toile: TOILES["4:5"] });
    expect(captureEcran({ src: SRC, toile: TOILES["4:5"] })).toEqual(a);
    for (const p of a!.barre.points) expect(["terracotta", "orange", "gris", "noir", "ivoire"]).toContain(p.couleur);
  });
});

describe("garde statique", () => {
  for (const f of ["src/briques/plan-scenes/tutoriel/capture.ts", "studio-rendu/compositions/plan-scenes/CaptureEcran.tsx"]) {
    const src = readFileSync(f, "utf8");
    it(`${f} : pas de @/`, () => expect(src).not.toMatch(/from\s+["']@\//));
    it(`${f} : pas d'hexadécimal`, () => expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/));
    it(`${f} : ni fetch ni signature`, () => {
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/signer|signature|presign|getSignedUrl/i);
    });
  }
  it("le rendu dessine l'image avec <Img> de Remotion", () => {
    const src = readFileSync("studio-rendu/compositions/plan-scenes/CaptureEcran.tsx", "utf8");
    expect(src).toMatch(/<Img\b/);
    expect(src).toMatch(/from\s+["']remotion["']/);
  });
});
