import { describe, it, expect } from "vitest";
import { cleCadence } from "./empreinte";

describe("cleCadence", () => {
  it("neutralise les accents", () => {
    expect(cleCadence({ pilier: "Données Clients", cible: "TPE" })).toBe("donnees clients|tpe");
  });

  it("neutralise la casse", () => {
    expect(cleCadence({ pilier: "DONNEES CLIENTS", cible: "PME" })).toBe("donnees clients|pme");
  });

  it("neutralise les espaces multiples et en bord", () => {
    expect(cleCadence({ pilier: " Données  Clients ", cible: "PME" })).toBe("donnees clients|pme");
  });

  it("a le format pilier|cible", () => {
    expect(cleCadence({ pilier: "Témoignages", cible: " artisans " })).toBe("temoignages|artisans");
  });

  it("produit la même clé pour des variantes de forme", () => {
    expect(cleCadence({ pilier: " Données  Clients ", cible: "PME" })).toBe(
      cleCadence({ pilier: "donnees clients", cible: "pme" })
    );
  });
});
