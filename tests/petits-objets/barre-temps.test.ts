/** X1-16 — barre de temps fine : pure, monotone, hors des zones des boutons des 4 formats (N-07), couleur de la charte. */
import { describe, expect, it } from "vitest";
import { barreTemps, EPAISSEUR_MAX_POURCENT } from "../../src/briques/motion/petits-objets/barre-temps";
import { CHARTE_AXION } from "../../src/briques/jetons-motion";
import { RATIOS_ESSAI, boiteDansZoneSure } from "@/moteurs/conformite-zone-sure";
import { listerReseaux } from "@/reseaux";

const ZONE_NULLE = { haut: 0, droite: 0, bas: 0, gauche: 0 };

describe("barreTemps — avancement", () => {
  it("monotone de 0 à 1", () => {
    let precedent = -1;
    for (let i = 0; i <= 100; i++) {
      const b = barreTemps({ image: i, dureeImages: 100, zone: ZONE_NULLE, fond: "ivoire" });
      expect(b.progression).toBeGreaterThanOrEqual(precedent);
      precedent = b.progression;
    }
    expect(barreTemps({ image: 0, dureeImages: 100, zone: ZONE_NULLE, fond: "ivoire" }).progression).toBe(0);
    expect(barreTemps({ image: 100, dureeImages: 100, zone: ZONE_NULLE, fond: "ivoire" }).progression).toBe(1);
  });
  it("largeur = temps écoulé / durée", () => {
    const b = barreTemps({ image: 25, dureeImages: 100, zone: ZONE_NULLE, fond: "ivoire" });
    expect(b.boite.largeur).toBeCloseTo(25, 9);
  });
  it("entrées absurdes : jamais d'exception, toujours dans [0, 1]", () => {
    for (const [image, dureeImages] of [[-5, 100], [200, 100], [NaN, 100], [10, 0], [10, NaN], [Infinity, 10]] as const) {
      const p = barreTemps({ image, dureeImages, zone: ZONE_NULLE, fond: "noir" }).progression;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
  it("même entrée = même sortie", () => {
    const a = barreTemps({ image: 37, dureeImages: 250, zone: ZONE_NULLE, fond: "ivoire" });
    expect(barreTemps({ image: 37, dureeImages: 250, zone: ZONE_NULLE, fond: "ivoire" })).toEqual(a);
  });
});

describe("barreTemps — épaisseur et couleur", () => {
  it("épaisseur ≤ 0,6 % de la hauteur", () => {
    expect(EPAISSEUR_MAX_POURCENT).toBeLessThanOrEqual(0.6);
    expect(barreTemps({ image: 50, dureeImages: 100, zone: ZONE_NULLE, fond: "ivoire" }).boite.hauteur).toBeLessThanOrEqual(0.6);
  });
  it("couleur de la charte : terracotta, sur les deux fonds", () => {
    expect(barreTemps({ image: 1, dureeImages: 10, zone: ZONE_NULLE, fond: "ivoire" }).couleur).toBe(CHARTE_AXION.terracotta);
    expect(barreTemps({ image: 1, dureeImages: 10, zone: ZONE_NULLE, fond: "noir" }).couleur).toBe(CHARTE_AXION.terracotta);
  });
});

describe("barreTemps — hors des zones des boutons (N-07), 4 formats", () => {
  for (const ratio of RATIOS_ESSAI) {
    for (const reseau of listerReseaux().filter((r) => r.zonesProtegees[ratio])) {
      it(`${ratio} · ${reseau.id} : barre pleine dans la zone sûre`, () => {
        const zone = reseau.zonesProtegees[ratio]!;
        for (const image of [0, 1, 50, 99, 100]) {
          const b = barreTemps({ image, dureeImages: 100, zone, fond: "ivoire" });
          if (b.boite.largeur === 0) continue;
          const r = boiteDansZoneSure(b.boite, ratio, [reseau.id]);
          expect(r.ok, r.raison).toBe(true);
        }
      });
    }
  }
});

describe("barreTemps — rail (FIX-X1-16-a)", () => {
  const rail = (image: number, zone = ZONE_NULLE, fond: "ivoire" | "noir" = "ivoire") => barreTemps({ image, dureeImages: 100, zone, fond });
  it("à 0 % la barre est vide et le rail est visible, pleine largeur de la zone", () => {
    const b = rail(0);
    expect(b.boite.largeur).toBe(0);
    expect(b.rail.boite.largeur).toBeCloseTo(100, 9);
    expect(b.rail.boite.hauteur).toBeGreaterThan(0);
    expect(b.rail.couleur).toMatch(/^rgba\(/);
  });
  it("barre ⊆ rail à tout instant (même y, même hauteur, x identique)", () => {
    for (let i = 0; i <= 100; i += 5) {
      const { boite, rail: r } = rail(i, { haut: 0, droite: 7, bas: 12, gauche: 4 });
      expect(r.boite.y).toBe(boite.y);
      expect(r.boite.hauteur).toBe(boite.hauteur);
      expect(boite.x).toBeGreaterThanOrEqual(r.boite.x);
      expect(boite.x + boite.largeur).toBeLessThanOrEqual(r.boite.x + r.boite.largeur + 1e-9);
    }
  });
  it("le rail ne dépend pas du temps et la barre existante est inchangée", () => {
    expect(rail(10).rail).toEqual(rail(90).rail);
    expect(rail(25).boite.largeur).toBeCloseTo(25, 9);
  });
  it("rail dans la zone sûre des 4 formats", () => {
    for (const ratio of RATIOS_ESSAI)
      for (const reseau of listerReseaux().filter((r) => r.zonesProtegees[ratio])) {
        const r = rail(0, reseau.zonesProtegees[ratio]!).rail;
        const v = boiteDansZoneSure(r.boite, ratio, [reseau.id]);
        expect(v.ok, v.raison).toBe(true);
      }
  });
  it("rail atténué : différent de la couleur de la barre, sur les deux fonds", () => {
    for (const fond of ["ivoire", "noir"] as const) expect(rail(50, ZONE_NULLE, fond).rail.couleur).not.toBe(rail(50, ZONE_NULLE, fond).couleur);
  });
});
