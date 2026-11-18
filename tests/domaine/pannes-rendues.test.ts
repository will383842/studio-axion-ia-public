import { describe, expect, it } from "vitest";
import { CODES_PANNE_RENDUE, estPanneRendue } from "@/domaine/pannes-rendues";

describe("estPanneRendue", () => {
  it("la liste fermée contient exactement les 5 codes", () => {
    expect([...CODES_PANNE_RENDUE]).toEqual(["TABLEAU_NON_RELIE", "CAS_CONCRET_NON_RELIE", "FACECAM_NON_RELIE", "FACECAM_ANIMEE_NON_RELIE", "IV_NON_RELIE"]);
  });
  it.each(CODES_PANNE_RENDUE)("%s : vrai seulement si reessayable === true", (code) => {
    expect(estPanneRendue({ code, reessayable: true })).toBe(true);
    expect(estPanneRendue({ code, reessayable: false })).toBe(false);
    expect(estPanneRendue({ code })).toBe(false);
  });
  it.each(["TABLEAU_DECOUPAGE_NON_RELIE", "CAS_CONCRET_FICHE_REFUSEE", "PANNE_SANS_NOUVELLE", "IV_SCRIPT_A_VALIDER", "FOURNISSEUR_INDISPONIBLE", "", "tableau_non_relie"])("code voisin ou autre %s : faux", (code) => {
    expect(estPanneRendue({ code, reessayable: true })).toBe(false);
  });
  it("pas d'erreur : faux", () => {
    expect(estPanneRendue(undefined)).toBe(false);
    expect(estPanneRendue(null)).toBe(false);
    expect(estPanneRendue({ reessayable: true })).toBe(false);
  });
});
