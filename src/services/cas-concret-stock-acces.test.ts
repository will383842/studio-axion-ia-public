import { describe, expect, it, vi } from "vitest";

vi.mock("./cas-concret-reglages", () => ({ REGLAGES_CAS_CONCRET: { stockMetiers: "casConcret.stockMetiers" }, reglageAllume: vi.fn(async () => false) }));

// Un faux cas du stock (le vrai stock.json est vide au départ) : il est AJOUTÉ au vrai catalogue, avec une phrase RGPD UNIQUE.
const { PHRASE_FAUX } = vi.hoisted(() => ({ PHRASE_FAUX: "Phrase RGPD unique du faux cas du stock (test K3)." }));
vi.mock("@/formats/cas-concret/catalogue", async (original) => {
  const vrai = await original<typeof import("@/formats/cas-concret/catalogue")>();
  const faux = { ...vrai.CATALOGUE[0]!, id: "stock-fab", conformite: { ...vrai.CATALOGUE[0]!.conformite, rgpd: { ...vrai.CATALOGUE[0]!.conformite?.rgpd, phrase: PHRASE_FAUX } } };
  return { ...vrai, CATALOGUE: [...vrai.CATALOGUE, faux], estCasStock: (id: string) => id === "stock-fab" || vrai.estCasStock(id), trouverCas: (id: string) => (id === "stock-fab" ? faux : vrai.trouverCas(id)) };
});

import { CATALOGUE, estCasStock } from "@/formats/cas-concret/catalogue";
import { PHRASES_FIXES_CAS_CONCRET } from "@/moteurs/montage-cas-concret/memoire-commune";
import { trouverCasAutorise } from "./cas-concret-stock-acces";
import { construireStockCas } from "./cas-concret-stock";

describe("accès aux cas du stock : réglage éteint = comme avant le stock", () => {
  it("un cas d'avant le stock est trouvé sans lire aucun réglage", async () => {
    const lire = vi.fn(async () => false);
    const id = CATALOGUE.find((c) => !estCasStock(c.id))!.id;
    expect((await trouverCasAutorise(id, lire))?.id).toBe(id);
    expect(lire).not.toHaveBeenCalled();
  });

  it("un cas du stock : trouvé seulement si le réglage est allumé", async () => {
    expect(await trouverCasAutorise("stock-fab", async () => false)).toBeUndefined();
    expect(await trouverCasAutorise("stock-fab", async () => {
      throw new Error("illisible");
    })).toBeUndefined();
    expect((await trouverCasAutorise("stock-fab", async () => true))?.id).toBe("stock-fab");
  });

  it("un cas inconnu reste inconnu", async () => {
    expect(await trouverCasAutorise("n-existe-pas", async () => true)).toBeUndefined();
  });

  it("le faux cas du stock est bien dans le catalogue, avec une phrase RGPD que personne d'autre n'a", () => {
    expect(CATALOGUE.some((c) => c.id === "stock-fab")).toBe(true);
    expect(estCasStock("stock-fab")).toBe(true);
    expect(CATALOGUE.filter((c) => c.conformite?.rgpd?.phrase === PHRASE_FAUX)).toHaveLength(1);
  });

  it("aucun cas du stock (réglage éteint) dans la mémoire (phrases fixes) ni dans le stock par défaut", () => {
    expect(PHRASES_FIXES_CAS_CONCRET).not.toContain(PHRASE_FAUX);
    const ids = construireStockCas({ scripts: {}, videos: [] }).map((l) => l.casId);
    expect(ids).not.toContain("stock-fab");
    expect(ids.some((id) => estCasStock(id))).toBe(false);
  });
});
