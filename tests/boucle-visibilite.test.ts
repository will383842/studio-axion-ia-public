import { describe, expect, it } from "vitest";
import { lireBoucleVisibilite, type EntreeBoucleVisibilite } from "@/services/boucle-visibilite";

const requetes = [
  { requete: "devis électricien", clics: 4, impressions: 400, position: 8.2 },
  { requete: "tarif plombier", clics: 30, impressions: 300, position: 2.1 },
  { requete: "avis couvreur", clics: 1, impressions: 150, position: 12 },
  { requete: "rare", clics: 0, impressions: 3, position: 40 },
];
const pages = [
  { page: "/guide-chauffage", visiteurs: 120 },
  { page: "/guide-isolation", visiteurs: 15 },
];

describe("boucle visibilité", () => {
  it("source absente : « non disponible », jamais d'invention", () => {
    const r = lireBoucleVisibilite({ searchConsole: null, plausible: null, calendrier: [] });
    expect(r.searchConsole).toBe("non disponible");
    expect(r.plausible).toBe("non disponible");
    expect(r.suggestions).toEqual([]);
  });

  it("une seule source absente n'empêche pas l'autre", () => {
    const r = lireBoucleVisibilite({ searchConsole: requetes, plausible: undefined, calendrier: [] });
    expect(r.searchConsole).toBe("disponible");
    expect(r.plausible).toBe("non disponible");
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it("propose les requêtes vues mais peu cliquées, la plus grosse marge d'abord", () => {
    const r = lireBoucleVisibilite({ searchConsole: requetes, plausible: null, calendrier: [] });
    expect(r.suggestions.map((s) => s.sujet)).toEqual(["devis électricien", "avis couvreur"]);
    expect(r.suggestions[0].source).toBe("search-console");
  });

  it("ne suggère pas un sujet déjà au calendrier (sans tenir compte de la casse)", () => {
    const r = lireBoucleVisibilite({ searchConsole: requetes, plausible: null, calendrier: ["Devis Électricien"] });
    expect(r.suggestions.map((s) => s.sujet)).toEqual(["avis couvreur"]);
  });

  it("Plausible : propose de prolonger les pages qui attirent", () => {
    const r = lireBoucleVisibilite({ searchConsole: null, plausible: pages, calendrier: [] });
    expect(r.suggestions).toHaveLength(1);
    expect(r.suggestions[0]).toMatchObject({ sujet: "/guide-chauffage", source: "plausible" });
  });

  it("simple suggestion : aucune écriture dans le calendrier, entrées non modifiées", () => {
    const calendrier = ["a"];
    const entree: EntreeBoucleVisibilite = { searchConsole: requetes, plausible: pages, calendrier };
    const copie = JSON.stringify(entree);
    const r = lireBoucleVisibilite(entree);
    expect(r.ecritureCalendrier).toBe(false);
    expect(r.suggestions.every((s) => s.statut === "suggestion")).toBe(true);
    expect(JSON.stringify(entree)).toBe(copie);
    expect(calendrier).toEqual(["a"]);
  });

  it("données douteuses ignorées sans planter", () => {
    const r = lireBoucleVisibilite({
      searchConsole: [{ requete: "", clics: 0, impressions: 500, position: 5 }, { requete: "x", clics: Number.NaN, impressions: 500, position: 5 }],
      plausible: [{ page: "/p", visiteurs: Number.NaN }],
      calendrier: [],
    });
    expect(r.suggestions).toEqual([]);
  });

  it("déterministe et plafonné", () => {
    const beaucoup = Array.from({ length: 30 }, (_, i) => ({ requete: `sujet ${i}`, clics: 0, impressions: 100 + i, position: 9 }));
    const a = lireBoucleVisibilite({ searchConsole: beaucoup, plausible: null, calendrier: [] });
    const b = lireBoucleVisibilite({ searchConsole: beaucoup, plausible: null, calendrier: [] });
    expect(a).toEqual(b);
    expect(a.suggestions.length).toBeLessThanOrEqual(10);
  });
});
