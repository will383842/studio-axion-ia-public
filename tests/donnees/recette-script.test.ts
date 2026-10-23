import { describe, expect, it } from "vitest";
import { plafondMotsParSec } from "@/domaine/debit-voix";
import { CONSIGNE_COURT_SCRIPT } from "@/generateur/chaine-courte";
import { ANTI_PATTERNS_SCRIPT, ECRAN_MOTS_MAX, MOTIF_RUPTURE, MOTS_PAR_SEC_VIDEO_MAX, PHRASES_MAX_45S, QUESTIONS_MAX, RECETTE_SCRIPT, ruptureDite } from "@/donnees/generateur/recette-script";

describe("recette commune des scripts", () => {
  it("porte les 8 éléments dans l'ordre", () => {
    const reperes = ["1. Accroche", "2. Douleur", "3. Question", "4. Promesse", "5. UNE seule idée", "6. Preuve", "7. Rupture", "8. Appel"];
    let dernier = -1;
    for (const r of reperes) {
      const i = RECETTE_SCRIPT.indexOf(r);
      expect(i, r).toBeGreaterThan(dernier);
      dernier = i;
    }
  });
  it("liste les 5 anti-patterns et les constantes", () => {
    for (const a of ["A1", "A2", "A3", "A4", "A5"]) expect(ANTI_PATTERNS_SCRIPT).toContain(a);
    expect([PHRASES_MAX_45S, QUESTIONS_MAX, ECRAN_MOTS_MAX]).toEqual([12, 2, 5]);
    // Une seule source de débit : le plafond de debit-voix.ts, dit dans la recette.
    expect(MOTS_PAR_SEC_VIDEO_MAX).toBe(plafondMotsParSec());
    expect(RECETTE_SCRIPT).toContain("3,0 mots par seconde");
  });
  it("MOTIF_RUPTURE reconnaît « on s'en occupe pour vous » et refuse un appel seul", () => {
    expect(MOTIF_RUPTURE.test("Ces fiches, on les met en place pour vous.")).toBe(true);
    expect(MOTIF_RUPTURE.test("Ce tableau, on l'installe et on le fait tourner pour vous.")).toBe(true);
    expect(MOTIF_RUPTURE.test("Réservez un appel.")).toBe(false);
  });
  it("MOTIF_RUPTURE exige un verbe en « on » : « c'est coûteux pour vous » ne passe pas ; l'apostrophe typographique passe", () => {
    expect(ruptureDite("C'est coûteux pour vous.")).toBe(false);
    expect(ruptureDite("Un appel pour vous.")).toBe(false);
    expect(ruptureDite("Ce tableau, on l’installe pour vous.")).toBe(true);
    expect(ruptureDite("On s’en occupe.")).toBe(true);
    expect(ruptureDite("Ces fiches, on les met en place pour toi.")).toBe(true);
  });
  it("la recette est dans la partie en cache de la consigne du rôle script, avec les anti-patterns", () => {
    expect(CONSIGNE_COURT_SCRIPT).toContain(RECETTE_SCRIPT);
    expect(CONSIGNE_COURT_SCRIPT).toContain(ANTI_PATTERNS_SCRIPT);
  });
  it("aucune contradiction avec les maxima des rôles : accroche resserrée, appel imposé par le code", () => {
    expect(RECETTE_SCRIPT).toContain("resserres l'accroche retenue vers 6 à 11 mots");
    expect(RECETTE_SCRIPT).toContain("l'appel imposé par le code s'il est fourni");
  });
  it("rupture : accents retirés, formes « nous » et « on gère / prépare tout pour vous »", () => {
    for (const t of ["C'est nous qui le mettons en place.", "Nous mettons tout en place pour vous.", "On gère tout pour vous.", "On prépare tout pour vous.", "Nous nous en occupons.", "Nous installons tout pour vous."]) {
      expect(ruptureDite(t), t).toBe(true);
    }
    for (const t of ["C'est coûteux pour vous.", "Réservez un appel.", "Un outil de plus pour vous."]) expect(ruptureDite(t), t).toBe(false);
  });
});
