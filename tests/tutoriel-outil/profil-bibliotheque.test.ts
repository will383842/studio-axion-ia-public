/** N-02 : profil bibliothèque du format « tutoriel-outil » (donnée pure, éteint = identique). */
import { describe, expect, it } from "vitest";
import { ID } from "@/briques/bibliotheque-video/noms";
import { etatCapacite } from "@/briques/bibliotheque-video/catalogue";
import { PROFILS_DU_CODE, FORMATS_PROFIL_NEUTRE, profilDuFormat } from "@/briques/bibliotheque-video/profils";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";

describe("N-02 · profil tutoriel-outil", () => {
  const p = profilDuFormat("tutoriel-outil");
  it("profil du code, figé, hors liste neutre", () => {
    expect(PROFILS_DU_CODE["tutoriel-outil"]).toBe(p);
    expect(p.formatId).toBe("tutoriel-outil");
    expect(p.id).toBe("tutoriel-outil/1");
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.capacites)).toBe(true);
    expect(FORMATS_PROFIL_NEUTRE).not.toContain("tutoriel-outil");
  });
  it("verrou texte derrière double présent, aucun plafond, aucun bloc texteEcran (pas de visage)", () => {
    expect(p.verrous).toContain(ID.calqueTexteDerriereDouble);
    expect(p.plafonds).toEqual({});
    expect(p.blocs?.texteEcran).toBeUndefined();
  });
  it("chaque capacité permise est en production", () => {
    for (const [id, r] of Object.entries(p.capacites) as [IdCapacite, { permis: boolean }][]) {
      if (r.permis) expect(etatCapacite(id), id).toBe("prod");
    }
    expect(etatCapacite(ID.planScenesTutorielOutil)).toBe("prod");
  });
});
