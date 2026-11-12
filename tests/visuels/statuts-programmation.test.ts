import { describe, expect, it } from "vitest";
import { corbeillePermise, LIBELLES_STATUT, STATUTS_VISUEL, TRANSITIONS, transitionPermise } from "@/domaine/visuels/statuts";
import { projeterStatutVisuel } from "@/domaine/taxonomie-contenu";

describe("statuts de programmation d'un visuel", () => {
  it("valide -> programme est permis", () => {
    expect(transitionPermise("valide", "programme")).toBe(true);
  });

  it("depuis programme, seuls valide, publie et echec_envoi sont permis", () => {
    expect([...TRANSITIONS.programme].sort()).toEqual(["echec_envoi", "publie", "valide"]);
    for (const s of STATUTS_VISUEL) {
      expect(transitionPermise("programme", s)).toBe(["valide", "publie", "echec_envoi"].includes(s));
    }
  });

  it("echec_envoi existe avec son libellé", () => {
    expect(STATUTS_VISUEL).toContain("echec_envoi");
    expect(LIBELLES_STATUT.echec_envoi.length).toBeGreaterThan(0);
    expect(projeterStatutVisuel("echec_envoi")).toBe("echec");
  });

  it("les autres transitions restent inchangées", () => {
    expect(TRANSITIONS.brouillon).toEqual(["ecrit", "bloque"]);
    expect(TRANSITIONS.ecrit).toEqual(["rendu_en_cours"]);
    expect(TRANSITIONS.bloque).toEqual(["brouillon"]);
    expect(TRANSITIONS.rendu_en_cours).toEqual(["a_valider", "echec_rendu"]);
    expect(TRANSITIONS.echec_rendu).toEqual(["rendu_en_cours", "brouillon"]);
    expect(TRANSITIONS.a_valider).toEqual(["valide", "refuse"]);
    expect(TRANSITIONS.refuse).toEqual(["brouillon"]);
    expect(TRANSITIONS.valide).toEqual(["programme"]);
    expect(TRANSITIONS.publie).toEqual([]);
  });

  it("corbeillePermise reste faux pour programme et publie", () => {
    expect(corbeillePermise("programme")).toBe(false);
    expect(corbeillePermise("publie")).toBe(false);
  });
});
