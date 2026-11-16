/** G3-11 : profil bibliothèque du format « demo-facecam » (donnée pure, éteint = identique). */
import { describe, expect, it } from "vitest";
import { ID } from "@/briques/bibliotheque-video/noms";
import { etatCapacite } from "@/briques/bibliotheque-video/catalogue";
import { PROFILS_DU_CODE, FORMATS_PROFIL_NEUTRE, profilDuFormat } from "@/briques/bibliotheque-video/profils";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";

describe("G3-11 · profil demo-facecam", () => {
  const p = profilDuFormat("demo-facecam");
  it("profil du code, figé, hors liste neutre", () => {
    expect(PROFILS_DU_CODE["demo-facecam"]).toBe(p);
    expect(p.formatId).toBe("demo-facecam");
    expect(p.id).toBe("demo-facecam/1");
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.capacites)).toBe(true);
    expect(FORMATS_PROFIL_NEUTRE).not.toContain("demo-facecam");
  });
  it("verrou texte derrière double présent, aucun plafond", () => {
    expect(p.verrous).toContain(ID.calqueTexteDerriereDouble);
    expect(p.plafonds).toEqual({});
  });
  it("rien sur le visage : pavé et repère épaule non permis", () => {
    expect(p.capacites[ID.textePave]?.permis).toBe(false);
    expect(p.capacites[ID.texteRepereEpaule]?.permis).toBe(false);
  });
  it("chaque capacité permise est en production", () => {
    for (const [id, r] of Object.entries(p.capacites) as [IdCapacite, { permis: boolean }][]) {
      if (r.permis) expect(etatCapacite(id), id).toBe("prod");
    }
    expect(etatCapacite(ID.planScenesDemoFacecam)).toBe("prod");
    expect(p.capacites[ID.planScenesDemoFacecam]?.permis).toBe(true);
    expect(p.capacites[ID.cadrageZoomDemo]?.permis).toBe(true);
  });
});
