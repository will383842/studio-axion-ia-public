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
  it("« à » sans accent n'est pas un mot-outil : « Il y a 3 jours » ne devient pas « Il y »", () => {
    expect(legendeDuChiffre("Il y a 3 jours", "3 jours")).toBe("Il y a");
    expect(legendeDuChiffre("Relance à 3 jours", "3 jours")).toBe("Relance");
  });
  it("« sur » et « par » sont des comparatifs : la phrase entière", () => {
    expect(legendeDuChiffre("Un client sur 3", "3")).toBe("Un client sur 3");
    expect(legendeDuChiffre("Divisé par 2", "2")).toBe("Divisé par 2");
  });
  it("comparatifs étendus : la phrase entière", () => {
    for (const p of ["Près de 30 %", "Pres de 30 %", "Au moins 3 jours", "Au plus 3 jours", "Pas plus de 3 jours", "À peine 3 jours", "A peine 3 jours", "Presque 3 jours", "Dès 3 jours"]) {
      const chiffre = p.slice(p.search(/\d/u));
      expect(legendeDuChiffre(p, chiffre)).toBe(p);
    }
  });
  it("légende vide après les mots-outils : la tête, comme avant", () => {
    expect(legendeDuChiffre("En 3 jours", "3 jours")).toBe("En");
  });
  it("majuscules et apostrophe typographique", () => {
    expect(legendeDuChiffre("RELANCE A 3 JOURS", "3 JOURS")).toBe("RELANCE");
    expect(legendeDuChiffre("IL Y A 3 JOURS", "3 JOURS")).toBe("IL Y A");
    expect(legendeDuChiffre("Délai d’1 jour", "1 jour")).toBe("Délai");
    expect(legendeDuChiffre("RELANCE EN MOINS DE 3 JOURS", "3 JOURS")).toBe("RELANCE EN MOINS DE 3 JOURS");
  });
});
