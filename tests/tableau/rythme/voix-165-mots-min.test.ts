/**
 * LOT B2a — voix du tableau à ≈ 165 mots/min (décision de Will) : recette « voix-tableau/3 » (HeyGen 1,0, `atempo` 1,0,
 * blanc de fin de phrase 0,30 s). Le débit des durées vient de `domaine/debit-voix` (2,75 mots/s), pour le tableau seul :
 * ni le cas concret (recette 1,08) ni Image→vidéo (3,4 mots/s) ne bougent.
 */
import { describe, expect, it } from "vitest";
import { CARACTERES_PAR_MOT_FR, DEBIT_CIBLE_MOTS_PAR_SEC, plafondMotsParSec } from "@/domaine/debit-voix";
import { CARACTERES_PAR_SECONDE_TABLEAU, DEBIT_TABLEAU_MOTS_PAR_SEC, PLAFOND_DEBIT_TABLEAU_MOTS_PAR_SEC, RECETTE_CALEE } from "@/domaine/duree-tableau";
import { RECETTE_VOIX_CAS_CONCRET } from "@/moteurs/montage-cas-concret/recette-voix";
import { RECETTE_VOIX_TABLEAU, reglagesRecette } from "@/moteurs/montage-tableau/recette-voix";

describe("recette voix-tableau/3", () => {
  it("HeyGen 1,0, atempo 1,0, blanc de phrase 0,30 s, identifiant bumpé", () => {
    expect(RECETTE_VOIX_TABLEAU.id).toBe("voix-tableau/3");
    expect(RECETTE_VOIX_TABLEAU.synthese).toEqual({ fournisseur: "heygen", moteur: "starfish", vitesse: 1.0, locale: "fr-FR" });
    expect(RECETTE_VOIX_TABLEAU.filtres.atempo).toBe(1.0);
    expect(RECETTE_VOIX_TABLEAU.resserrage.blancPhraseSec).toBe(0.3);
    expect(reglagesRecette()).toMatchObject({ id: "voix-tableau/3" });
  });
  it("le cas concret garde sa recette gelée (1,08)", () => {
    expect(RECETTE_VOIX_CAS_CONCRET.filtres.atempo).toBe(1.08);
  });
});

describe("débit du tableau branché sur domaine/debit-voix", () => {
  it("2,75 mots/s, plafond +10 %, durées calées sur la recette /3", () => {
    expect(RECETTE_CALEE).toBe("voix-tableau/3");
    expect(DEBIT_TABLEAU_MOTS_PAR_SEC).toBe(DEBIT_CIBLE_MOTS_PAR_SEC);
    expect(PLAFOND_DEBIT_TABLEAU_MOTS_PAR_SEC).toBe(plafondMotsParSec());
    expect(CARACTERES_PAR_SECONDE_TABLEAU).toBeCloseTo(DEBIT_CIBLE_MOTS_PAR_SEC * CARACTERES_PAR_MOT_FR, 1);
    expect(Math.round(DEBIT_TABLEAU_MOTS_PAR_SEC * 60)).toBe(165);
  });
});
