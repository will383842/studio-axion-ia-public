/** X3-07a : cran du dosage -> contraintes du cas concret et du tableau (fonctions pures, non branchées). */
import { describe, expect, it } from "vitest";
import { appliquerContraintes, contraintesDosageCasConcret } from "@/moteurs/montage-cas-concret/dosage";
import { intensiteSousTitresTableau } from "@/moteurs/montage-tableau/dosage";
import { DENSITES_PARTICULES, FONDS_FORTS, INCLINAISONS, INTENSITES, ACCENTS, HAUTEURS_SOUS_TITRES, type Tirage } from "@/moteurs/montage-cas-concret/variete";

function tirageSimule(i: number): Tirage {
  return {
    graine: i * 7919,
    sel: i % 3,
    fondFort: FONDS_FORTS[i % 3],
    particules: { groupe: i % 6, densite: DENSITES_PARTICULES[i % 3] },
    sousTitres: { inclinaison: INCLINAISONS[i % 2], intensite: INTENSITES[i % 3], accent: ACCENTS[i % 2], hauteur: HAUTEURS_SOUS_TITRES[i % 2] },
    relache: i % 4,
  } as unknown as Tirage;
}

describe("contraintesDosageCasConcret", () => {
  it("sobre : calme, légère, fond fort 0", () => {
    expect(contraintesDosageCasConcret("sobre")).toEqual({ sousTitres: { intensite: "calme" }, particules: { densite: "legere" }, fondFort: 0 });
  });
  it("dynamique : sous-titres vifs seulement", () => {
    expect(contraintesDosageCasConcret("dynamique")).toEqual({ sousTitres: { intensite: "vif" } });
  });
  it("équilibre et sans cran : aucune contrainte", () => {
    expect(contraintesDosageCasConcret("equilibre")).toBeUndefined();
    expect(contraintesDosageCasConcret(undefined)).toBeUndefined();
  });
  it("aucun est impossible ici (CRANS_PERMIS) : erreur claire", () => {
    expect(() => contraintesDosageCasConcret("aucun")).toThrow(/aucun/);
  });
});

describe("appliquerContraintes", () => {
  it("sans contrainte : copie égale en profondeur sur 20 tirages", () => {
    for (let i = 0; i < 20; i++) {
      const t = tirageSimule(i);
      expect(appliquerContraintes(t, undefined)).toEqual(t);
    }
  });
  it("sobre : remplace seulement les champs visés, sans muter l'entrée", () => {
    for (let i = 0; i < 20; i++) {
      const t = tirageSimule(i);
      const avant = structuredClone(t);
      const r = appliquerContraintes(t, contraintesDosageCasConcret("sobre"));
      expect(t).toEqual(avant);
      expect(r).not.toBe(t);
      expect(r.sousTitres.intensite).toBe("calme");
      expect(r.particules.densite).toBe("legere");
      expect(r.fondFort).toBe(0);
      expect(r.particules.groupe).toBe(t.particules.groupe);
      expect({ ...r.sousTitres, intensite: 0 }).toEqual({ ...t.sousTitres, intensite: 0 });
      expect(r.relache).toBe(t.relache);
      expect(r.graine).toBe(t.graine);
    }
  });
  it("dynamique : seule l'intensité des sous-titres change", () => {
    const t = tirageSimule(4);
    const r = appliquerContraintes(t, contraintesDosageCasConcret("dynamique"));
    expect(r.sousTitres.intensite).toBe("vif");
    expect(r.fondFort).toBe(t.fondFort);
    expect(r.particules).toEqual(t.particules);
  });
});

describe("intensiteSousTitresTableau", () => {
  it("sans cran ou équilibre : l'actuelle, telle quelle", () => {
    expect(intensiteSousTitresTableau(undefined, "tres-dynamique")).toBe("tres-dynamique");
    expect(intensiteSousTitresTableau("equilibre", undefined)).toBeUndefined();
    expect(intensiteSousTitresTableau("equilibre", "sobre")).toBe("sobre");
  });
  it("sobre et dynamique : suit le cran", () => {
    expect(intensiteSousTitresTableau("sobre", "equilibre")).toBe("sobre");
    expect(intensiteSousTitresTableau("dynamique", "sobre")).toBe("tres-dynamique");
  });
});
