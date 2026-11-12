import { describe, expect, it } from "vitest";
import { fournisseurParId, resoudreFournisseur } from "@/fournisseurs";

describe("z1t · registre par identifiant de fournisseur", () => {
  it("renvoie le fournisseur demandé quand il est inscrit", () => {
    expect(fournisseurParId("publication", "simulation").id).toBe("simulation");
  });
  it("refuse clairement un fournisseur non inscrit, sans repli silencieux", () => {
    expect(() => fournisseurParId("publication", "zernio")).toThrow(/n'est pas relié/);
    expect(() => fournisseurParId("publication", "constructor")).toThrow(/refusé/);
  });
  it("resoudreFournisseur reste inchangé (repli simulation des anciens appels)", () => {
    expect(resoudreFournisseur("publication", "zernio").id).toBe("simulation");
  });
});
