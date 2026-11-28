import { describe, expect, it } from "vitest";
import { actionUtileApresRefus } from "./action-utile";

const DEBUT = "Ce refus reviendrait à l'identique : ";

describe("actionUtileApresRefus", () => {
  it("renvoie null quand l'erreur est absente, réessayable ou sans indication", () => {
    expect(actionUtileApresRefus(null)).toBeNull();
    expect(actionUtileApresRefus(undefined)).toBeNull();
    expect(actionUtileApresRefus({ code: "IV_X" })).toBeNull();
    expect(actionUtileApresRefus({ code: "IV_X", reessayable: true })).toBeNull();
  });

  it.each([
    ["TABLEAU_VIDE", "ouvrez la vidéo, corrigez la fiche ou touchez « Relancer » sur sa page."],
    ["CAS_CONCRET_MANQUANT", "reprenez le cas ou la fiche depuis la page de la vidéo."],
    ["IV_SCRIPT", "ouvrez la vidéo et touchez « Refaire le script »."],
    ["FACECAM_MONTAGE", "redemandez la modification au monteur depuis la page de la vidéo."],
  ])("choisit l'action du préfixe de %s", (code, action) => {
    expect(actionUtileApresRefus({ code, reessayable: false })).toBe(`${DEBUT}${action}`);
  });

  it("se replie sur « ouvrez la vidéo pour la corriger. » pour un code inconnu ou absent", () => {
    expect(actionUtileApresRefus({ code: "AUTRE_CHOSE", reessayable: false })).toBe(`${DEBUT}ouvrez la vidéo pour la corriger.`);
    expect(actionUtileApresRefus({ reessayable: false })).toBe(`${DEBUT}ouvrez la vidéo pour la corriger.`);
  });

  it("ne reconnaît un préfixe qu'en début de code", () => {
    expect(actionUtileApresRefus({ code: "X_IV_SCRIPT", reessayable: false })).toBe(`${DEBUT}ouvrez la vidéo pour la corriger.`);
  });

  it("place le message, rogné, avant la phrase", () => {
    expect(actionUtileApresRefus({ code: "IV_SCRIPT", reessayable: false, messagePourWill: "  Le script est vide.  " })).toBe(
      `Le script est vide. ${DEBUT}ouvrez la vidéo et touchez « Refaire le script ».`,
    );
  });

  it("n'ajoute rien devant la phrase si le message est vide ou fait d'espaces", () => {
    expect(actionUtileApresRefus({ code: "IV_SCRIPT", reessayable: false, messagePourWill: "   " })?.startsWith(DEBUT)).toBe(true);
    expect(actionUtileApresRefus({ code: "IV_SCRIPT", reessayable: false, messagePourWill: "" })?.startsWith(DEBUT)).toBe(true);
  });
});
