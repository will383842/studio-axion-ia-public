import { describe, expect, it, vi } from "vitest";
import {
  CATEGORIES_PERSONNE,
  REGLES_RETENTION,
  SEUIL_ATTENTION_PCT,
  SEUIL_CRITIQUE_PCT,
  evaluerCharge,
  niveauSeuil,
  pourcentage,
  regleVisePersonne,
  type Mesure,
} from "@/services/seuils-echelle";

describe("L8-06 niveauSeuil : limites exactes", () => {
  it.each([
    [0, "normal"],
    [69, "normal"],
    [69.99, "normal"],
    [70, "attention"],
    [89, "attention"],
    [89.99, "attention"],
    [90, "critique"],
    [100, "critique"],
    [150, "critique"],
    [-1, "invalide"],
    [Number.NaN, "invalide"],
    [Number.POSITIVE_INFINITY, "invalide"],
  ])("%s %% → %s", (pct, attendu) => {
    expect(niveauSeuil(pct)).toBe(attendu);
  });

  it("les seuils sont 70 et 90", () => {
    expect(SEUIL_ATTENTION_PCT).toBe(70);
    expect(SEUIL_CRITIQUE_PCT).toBe(90);
  });
});

describe("L8-06 pourcentage", () => {
  it("calcule, et refuse une capacité nulle ou négative", () => {
    expect(pourcentage(35, 50)).toBe(70);
    expect(Number.isNaN(pourcentage(1, 0))).toBe(true);
    expect(Number.isNaN(pourcentage(-1, 10))).toBe(true);
  });
});

describe("L8-06 test de charge simulé (aucun appel réel)", () => {
  it("les alertes se déclenchent aux seuils sur les cinq mesures, sans réseau", () => {
    const fetchEspion = vi.fn();
    vi.stubGlobal("fetch", fetchEspion);
    try {
      const capacite = 1000;
      const mesures = (u: number): Mesure[] =>
        (["file", "rendus", "appels", "base", "r2"] as const).map((nom) => ({ nom, utilise: u, capacite }));
      const vus: Record<number, string[]> = {};
      for (let u = 0; u <= 1000; u += 10) {
        vus[u] = evaluerCharge(mesures(u)).map((a) => a.niveau);
      }
      expect(vus[690]).toEqual([]);
      expect(vus[700]).toEqual(Array(5).fill("attention"));
      expect(vus[890]).toEqual(Array(5).fill("attention"));
      expect(vus[900]).toEqual(Array(5).fill("critique"));
      expect(vus[1000]).toEqual(Array(5).fill("critique"));
      expect(fetchEspion).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("une mesure invalide produit une alerte « invalide », jamais le silence", () => {
    const a = evaluerCharge([{ nom: "base", utilise: 5, capacite: 0 }]);
    expect(a).toHaveLength(1);
    expect(a[0].niveau).toBe("invalide");
  });

  it("le texte des alertes ne contient ni adresse ni jeton", () => {
    const [a] = evaluerCharge([{ nom: "r2", utilise: 95, capacite: 100 }]);
    expect(a.message).toMatch(/r2/i);
    expect(a.message).not.toMatch(/@|[A-Za-z0-9_+/=]{32,}/);
  });
});

describe("L8-06 rétention", () => {
  it("aucune règle ne vise une donnée de personne", () => {
    expect(REGLES_RETENTION.length).toBeGreaterThan(0);
    for (const r of REGLES_RETENTION) {
      expect(regleVisePersonne(r)).toBe(false);
      expect(r.categorie).toBe("media-genere-non-publie");
    }
  });

  it("détecte une règle qui viserait une donnée de personne", () => {
    for (const c of CATEGORIES_PERSONNE) {
      expect(regleVisePersonne({ id: "x", categorie: c, joursMax: 30 })).toBe(true);
    }
    expect(regleVisePersonne({ id: "x", categorie: "inconnue", joursMax: 30 })).toBe(true);
  });
});
