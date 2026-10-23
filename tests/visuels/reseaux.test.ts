import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LIMITES } from "../../src/briques/visuels/limites.js";
import {
  PROFILS_RESEAUX,
  cadreDe,
  intersecte,
  ratioPermisInstagram,
  retraitCouverture,
  zonesInterdites,
  type Cadre,
  type Rect,
  type Reseau,
} from "../../src/briques/visuels/reseaux.js";

const RESEAUX: Reseau[] = ["linkedin", "instagram", "facebook"];
const CADRES: Cadre[] = ["linkedin", "meta"];

describe("profils par réseau", () => {
  it("chaque zone interdite est entièrement dans la page 1080x1350", () => {
    for (const cadre of CADRES) {
      for (const index of [0, 1, 5]) {
        for (const z of zonesInterdites(cadre, index)) {
          expect(z.x).toBeGreaterThanOrEqual(0);
          expect(z.y).toBeGreaterThanOrEqual(0);
          expect(z.x + z.largeur).toBeLessThanOrEqual(1080);
          expect(z.y + z.hauteur).toBeLessThanOrEqual(1350);
          expect(z.largeur).toBeGreaterThan(0);
          expect(z.hauteur).toBeGreaterThan(0);
        }
      }
    }
  });

  it("instagram et facebook partagent le même cadre meta ; linkedin a le sien", () => {
    expect(cadreDe("instagram")).toBe("meta");
    expect(cadreDe("facebook")).toBe("meta");
    expect(cadreDe("instagram")).toBe(cadreDe("facebook"));
    expect(cadreDe("linkedin")).toBe("linkedin");
  });

  it("les profils portent les limites attendues", () => {
    for (const r of RESEAUX) {
      expect(PROFILS_RESEAUX[r].format).toEqual({ largeur: 1080, hauteur: 1350 });
      expect(PROFILS_RESEAUX[r].pagesMax).toBe(10);
      expect(PROFILS_RESEAUX[r].altMax).toBe(125);
      expect(PROFILS_RESEAUX[r].cadre).toBe(cadreDe(r));
    }
    expect(PROFILS_RESEAUX.linkedin.livrable).toBe("pdf");
    expect(PROFILS_RESEAUX.instagram.livrable).toBe("images");
    expect(PROFILS_RESEAUX.facebook.livrable).toBe("images");
    expect(PROFILS_RESEAUX.linkedin.titreDocumentMax).toBe(40);
    expect(PROFILS_RESEAUX.linkedin.legendeMax).toBe(3000);
    expect(PROFILS_RESEAUX.instagram.legendeMax).toBe(2200);
    expect(PROFILS_RESEAUX.facebook.legendeMax).toBe(5000);
    expect(PROFILS_RESEAUX.instagram.ratioApi).toEqual({ min: 0.8, max: 1.91 });
  });

  it("pagesMax ne dépasse pas LIMITES.pagesMax", () => {
    for (const r of RESEAUX) expect(PROFILS_RESEAUX[r].pagesMax).toBeLessThanOrEqual(LIMITES.pagesMax);
  });

  it("les zones de la couverture contiennent celles des autres pages", () => {
    for (const cadre of CADRES) {
      const couverture = zonesInterdites(cadre, 0);
      for (const z of zonesInterdites(cadre, 1)) {
        const trouve = couverture.some((c) => c.nom === z.nom && c.x === z.x && c.y === z.y && c.largeur === z.largeur && c.hauteur === z.hauteur);
        expect(trouve).toBe(true);
      }
      expect(couverture.length).toBeGreaterThanOrEqual(zonesInterdites(cadre, 1).length);
    }
    expect(zonesInterdites("meta", 1)).toHaveLength(0);
    expect(zonesInterdites("linkedin", 1).map((z) => z.nom).sort()).toEqual(["flecheSuivante", "pleinEcran"]);
  });

  it("zones de couverture et fiabilités attendues", () => {
    const noms = (c: Cadre) => zonesInterdites(c, 0).map((z) => z.nom).sort();
    expect(noms("linkedin")).toEqual(["flecheSuivante", "pastilleTitre", "pleinEcran"]);
    expect(noms("meta")).toEqual(["carreFacebookBas", "carreFacebookHaut", "compteurInstagram", "grilleDroite", "grilleGauche"]);
    for (const z of zonesInterdites("linkedin", 0)) expect(z.fiabilite).toBe("mesure-tiers-2026-09");
    for (const z of zonesInterdites("meta", 0)) expect(z.fiabilite).toBe("hypothese");
    const pastille = zonesInterdites("linkedin", 0).find((z) => z.nom === "pastilleTitre");
    expect(pastille).toMatchObject({ x: 0, y: 0, largeur: 1080, hauteur: 170 });
  });

  it("intersecte : bords touchants = pas d'intersection", () => {
    const a = { x: 0, y: 0, largeur: 100, hauteur: 100 };
    expect(intersecte(a, { x: 50, y: 50, largeur: 100, hauteur: 100 })).toBe(true);
    expect(intersecte(a, { x: 100, y: 0, largeur: 50, hauteur: 50 })).toBe(false);
    expect(intersecte(a, { x: 0, y: 100, largeur: 50, hauteur: 50 })).toBe(false);
    expect(intersecte(a, { x: 101, y: 101, largeur: 5, hauteur: 5 })).toBe(false);
    expect(intersecte(a, { x: 10, y: 10, largeur: 5, hauteur: 5 })).toBe(true);
    const r: Rect = zonesInterdites("linkedin", 0)[0]!;
    expect(intersecte(r, r)).toBe(true);
  });

  it("ratioPermisInstagram : 4:5 à 1,91:1 inclus", () => {
    expect(ratioPermisInstagram(1080, 1350)).toBe(true);
    expect(ratioPermisInstagram(1080, 1440)).toBe(false);
    expect(ratioPermisInstagram(1080, 1080)).toBe(true);
    expect(ratioPermisInstagram(1910, 1000)).toBe(true);
    expect(ratioPermisInstagram(1920, 1000)).toBe(false);
    expect(ratioPermisInstagram(1080, 0)).toBe(false);
  });

  it("retraitCouverture", () => {
    expect(retraitCouverture("linkedin")).toEqual({ haut: 170, bas: 135 });
    expect(retraitCouverture("meta")).toEqual({ haut: 170, bas: 135 });
  });

  it("le source n'a aucune dépendance interdite", () => {
    const src = readFileSync(join(process.cwd(), "src/briques/visuels/reseaux.ts"), "utf8");
    expect(src).not.toContain('from "@/');
    expect(src).not.toContain("zod");
    expect(src).not.toContain("server-only");
  });
});
