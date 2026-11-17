/** Lecture d'une raison stockée (`refusPrive`) : valeurs fictives. */
import { describe, expect, it } from "vitest";
import { lireRaisonStockee } from "@/domaine/guide-reseau/raison-refus-lue";

const valide = () => ({
  motif: "fenetre-7-jours-depassee",
  statut: 400,
  codeClient: "refuse",
  meta: { code: 10, sousCode: 2534024 },
  codeZernio: null,
  source: "nombres",
  le: "2026-06-01T10:00:00.000Z",
});

describe("lireRaisonStockee", () => {
  it("accepte une raison valide avec sa date", () => {
    expect(lireRaisonStockee(valide())).toEqual(valide());
  });
  it("refuse une clé en plus, un motif inconnu, une date illisible ou absente, un code client libre", () => {
    expect(lireRaisonStockee({ ...valide(), pseudo: "x" })).toBeNull();
    expect(lireRaisonStockee({ ...valide(), motif: "inconnu" })).toBeNull();
    expect(lireRaisonStockee({ ...valide(), le: "pas une date" })).toBeNull();
    expect(lireRaisonStockee({ ...valide(), le: 123 })).toBeNull();
    const { le: _le, ...sansLe } = valide();
    expect(lireRaisonStockee(sansLe)).toBeNull();
    expect(
      lireRaisonStockee({ ...valide(), codeClient: "texte libre" }),
    ).toBeNull();
  });
  it("refuse null, tableau, chaîne, nombre, undefined", () => {
    for (const x of [null, undefined, [], [valide()], "texte", 4])
      expect(lireRaisonStockee(x)).toBeNull();
  });
});
