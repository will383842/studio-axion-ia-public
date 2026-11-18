/**
 * S-02 · `actionUtileApresRefus` : un refus que la même entrée redonnerait dit l'action utile, par préfixe de code.
 * Fonction pure : aucune phrase ne contient de chiffre ni de « € ».
 */
import { describe, expect, it } from "vitest";
import { actionUtileApresRefus } from "@/domaine/action-utile";

const refus = (code: string, extra: Record<string, unknown> = {}) => ({ code, reessayable: false, messagePourWill: "La fiche est refusée.", ...extra });
const PREFIXES = ["TABLEAU_", "CAS_CONCRET_", "IV_", "FACECAM_", "AUTRE_"];

describe("actionUtileApresRefus", () => {
  it("rend null sans erreur, ou pour une erreur réessayable ou sans indication", () => {
    expect(actionUtileApresRefus(undefined)).toBeNull();
    expect(actionUtileApresRefus(null)).toBeNull();
    for (const p of PREFIXES) {
      expect(actionUtileApresRefus(refus(`${p}X`, { reessayable: true }))).toBeNull();
      expect(actionUtileApresRefus({ code: `${p}X`, messagePourWill: "Panne." })).toBeNull();
    }
  });

  it("choisit la phrase par préfixe, la raison du moteur devant", () => {
    expect(actionUtileApresRefus(refus("TABLEAU_FICHE_REFUSEE"))).toBe("La fiche est refusée. Ce refus reviendrait à l'identique : ouvrez la vidéo, corrigez la fiche ou touchez « Relancer » sur sa page.");
    expect(actionUtileApresRefus(refus("CAS_CONCRET_FICHE_REFUSEE"))).toContain("reprenez le cas ou la fiche depuis la page de la vidéo.");
    expect(actionUtileApresRefus(refus("IV_SCRIPT"))).toContain("ouvrez la vidéo et touchez « Refaire le script ».");
    expect(actionUtileApresRefus(refus("FACECAM_X"))).toContain("redemandez la modification au monteur depuis la page de la vidéo.");
    expect(actionUtileApresRefus(refus("PANNE_X"))).toContain("ouvrez la vidéo pour la corriger.");
    for (const p of PREFIXES) expect(actionUtileApresRefus(refus(`${p}X`))?.startsWith("La fiche est refusée. Ce refus reviendrait à l'identique : ")).toBe(true);
  });

  it("sans raison du moteur, la phrase d'action seule ; aucune phrase ne contient de chiffre ni de €", () => {
    for (const p of PREFIXES) {
      const phrase = actionUtileApresRefus({ code: `${p}X`, reessayable: false, messagePourWill: "" });
      expect(phrase?.startsWith("Ce refus reviendrait à l'identique")).toBe(true);
      expect(phrase).not.toMatch(/[0-9€]/);
    }
  });
});
