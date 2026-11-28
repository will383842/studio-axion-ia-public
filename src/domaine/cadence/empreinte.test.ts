import { describe, expect, it } from "vitest";
import { cleCadence } from "./empreinte";

describe("cleCadence", () => {
  it("donne le format pilier|cible, sans accents ni casse, espaces réduits et rognés", () => {
    expect(cleCadence({ pilier: " Données  Clients ", cible: "PME" })).toBe("donnees clients|pme");
  });

  it("neutralise les accents", () => {
    expect(cleCadence({ pilier: "Éthique", cible: "Dirigeants à l'écoute" })).toBe("ethique|dirigeants a l'ecoute");
  });

  it("neutralise la casse", () => {
    expect(cleCadence({ pilier: "AUTOMATISATION", cible: "tpe" })).toBe(cleCadence({ pilier: "automatisation", cible: "TPE" }));
  });

  it("réduit les espaces multiples et rogne les bords", () => {
    expect(cleCadence({ pilier: "  a   b  ", cible: "\t c \n d " })).toBe("a b|c d");
  });

  it("donne la même clé pour deux écritures équivalentes", () => {
    expect(cleCadence({ pilier: "Données clients", cible: "PME" })).toBe(cleCadence({ pilier: " DONNEES   CLIENTS", cible: " pme " }));
  });

  it("distingue deux cibles différentes", () => {
    expect(cleCadence({ pilier: "Données", cible: "PME" })).not.toBe(cleCadence({ pilier: "Données", cible: "TPE" }));
  });

  it("garde le séparateur même avec des champs vides", () => {
    expect(cleCadence({ pilier: "", cible: "" })).toBe("|");
  });
});
