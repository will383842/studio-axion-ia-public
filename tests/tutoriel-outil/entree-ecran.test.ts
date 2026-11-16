import { describe, expect, it } from "vitest";
import { lireEntreesTutoriel } from "../../src/moteurs/montage-tutoriel-outil/entrees";
import { lireEntreeEcranTutoriel } from "../../src/moteurs/montage-tutoriel-outil/entree-ecran";

const suiviOk = { version: 1, origine: "fichier", imagesParSeconde: 30, largeur: 1920, hauteur: 1080, curseur: [{ tMs: 0, x: 10, y: 20 }], clics: [], zones: [] };

describe("lireEntreeEcranTutoriel", () => {
  it("absent → null, sans remarque ni exception", () => {
    for (const e of [undefined, {}, { tutorielOutil: {} }, { tutorielOutil: null }, { tutorielOutil: "x" }]) {
      expect(lireEntreeEcranTutoriel(e as Record<string, unknown> | undefined)).toEqual({ entree: null, remarques: [] });
    }
  });

  it("mal formé → null + remarques, jamais d'exception", () => {
    const cas: unknown[] = [
      "texte",
      { cle: "", suivi: suiviOk },
      { cle: 3, suivi: suiviOk },
      { suivi: suiviOk },
      { cle: "ecran/a.mp4" },
      { cle: "ecran/a.mp4", suivi: { version: 1 } },
    ];
    for (const sourceEcran of cas) {
      const r = lireEntreeEcranTutoriel({ tutorielOutil: { sourceEcran } });
      expect(r.entree).toBeNull();
      expect(r.remarques.length).toBeGreaterThan(0);
    }
  });

  it("bien formé → clé + suivi", () => {
    const r = lireEntreeEcranTutoriel({ tutorielOutil: { sourceEcran: { cle: " ecran/a.mp4 ", suivi: suiviOk } } });
    expect(r.entree?.cle).toBe("ecran/a.mp4");
    expect(r.entree?.suivi.largeur).toBe(1920);
    expect(r.entree?.suivi.curseur).toHaveLength(1);
  });

  it("éteint = identique : lireEntreesTutoriel ignore sourceEcran et rend la même chose", () => {
    const base = { idee: "Un outil", scriptColle: true, scriptValide: "Le script." };
    const sans = lireEntreesTutoriel({ tutorielOutil: base });
    const avec = lireEntreesTutoriel({ tutorielOutil: { ...base, sourceEcran: { cle: "a.mp4", suivi: suiviOk } } });
    expect(avec).toEqual(sans);
    expect(lireEntreesTutoriel(undefined)).toEqual({});
  });
});
