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
