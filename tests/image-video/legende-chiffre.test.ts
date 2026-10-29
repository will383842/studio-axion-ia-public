import { describe, expect, it } from "vitest";
import { legendeDuChiffre } from "@/moteurs/montage-image-video/legende-chiffre";

describe("légende d'un chiffre dans l'ordre de lecture", () => {
  it("chiffre en fin : la légende est ce qui précède, sans le mot-outil final", () => {
    expect(legendeDuChiffre("Relance à 3 jours", "3 jours")).toBe("Relance");
    expect(legendeDuChiffre("Délai d'1 jour", "1 jour")).toBe("Délai");
  });
  it("chiffre en tête : ce qui suit, inchangé", () => {
    expect(legendeDuChiffre("80 % Réponse connue", "80 %")).toBe("Réponse connue");
  });
  it("chiffre en fin sans mot-outil : inchangé", () => {
    expect(legendeDuChiffre("Recherche : 23 min", "23 min")).toBe("Recherche");
  });
  it("comparatif : la phrase entière, jamais un sens faux", () => {
    expect(legendeDuChiffre("Relance en moins de 3 jours", "3 jours")).toBe("Relance en moins de 3 jours");
    expect(legendeDuChiffre("Réponse jusqu'à 3 jours", "3 jours")).toBe("Réponse jusqu'à 3 jours");
  });
  it("chiffre au milieu ou absent : comme avant", () => {
    expect(legendeDuChiffre("Réponse 80 % connue", "80 %")).toBe("Réponse  connue");
    expect(legendeDuChiffre("Réponse connue", "80 %")).toBe("Réponse connue");
  });
});
