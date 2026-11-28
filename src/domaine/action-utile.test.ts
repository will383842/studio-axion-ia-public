import { describe, expect, it } from "vitest";
import { actionUtileApresRefus } from "./action-utile";

/** S-02 : la fonction reste pure ; chaque préfixe de code donne son action exacte, le repli sinon. */
describe("actionUtileApresRefus", () => {
  it("null quand l'erreur est réessayable ou incomplète", () => {
    expect(actionUtileApresRefus(null)).toBeNull();
    expect(actionUtileApresRefus(undefined)).toBeNull();
    expect(actionUtileApresRefus({ reessayable: true, code: "TABLEAU_X" })).toBeNull();
    expect(actionUtileApresRefus({ code: "TABLEAU_X" })).toBeNull();
  });

  it("chaque préfixe de code donne son action", () => {
    expect(actionUtileApresRefus({ reessayable: false, code: "TABLEAU_1" })).toBe("Ce refus reviendrait à l'identique : ouvrez la vidéo, corrigez la fiche ou touchez « Relancer » sur sa page.");
    expect(actionUtileApresRefus({ reessayable: false, code: "CAS_CONCRET_9" })).toBe("Ce refus reviendrait à l'identique : reprenez le cas ou la fiche depuis la page de la vidéo.");
    expect(actionUtileApresRefus({ reessayable: false, code: "IV_FLOPPE" })).toBe("Ce refus reviendrait à l'identique : ouvrez la vidéo et touchez « Refaire le script ».");
    expect(actionUtileApresRefus({ reessayable: false, code: "FACECAM_BROUILLON" })).toBe("Ce refus reviendrait à l'identique : redemandez la modification au monteur depuis la page de la vidéo.");
  });

  it("code inconnu ou absent : repli « ouvrez la vidéo pour la corriger. »", () => {
    expect(actionUtileApresRefus({ reessayable: false, code: "TRUC_INCONNU" })).toBe("Ce refus reviendrait à l'identique : ouvrez la vidéo pour la corriger.");
    expect(actionUtileApresRefus({ reessayable: false })).toBe("Ce refus reviendrait à l'identique : ouvrez la vidéo pour la corriger.");
  });

  it("le message est rogné puis placé avant la phrase", () => {
    expect(actionUtileApresRefus({ reessayable: false, code: "IV_X", messagePourWill: "  Script refusé.  " })).toBe("Script refusé. Ce refus reviendrait à l'identique : ouvrez la vidéo et touchez « Refaire le script ».");
  });

  it("message vide ou absent : rien avant la phrase", () => {
    expect(actionUtileApresRefus({ reessayable: false, code: "IV_X", messagePourWill: "   " })).toBe("Ce refus reviendrait à l'identique : ouvrez la vidéo et touchez « Refaire le script ».");
    expect(actionUtileApresRefus({ reessayable: false, code: "IV_X", messagePourWill: undefined })).toBe("Ce refus reviendrait à l'identique : ouvrez la vidéo et touchez « Refaire le script ».");
  });
});
