import { describe, expect, it } from "vitest";
import { TYPES_AUTOMATISATION } from "@/domaine/ciblage/types";
import { LIBELLE_SUJET_EXTRAIT, MOTIF_APPELS_OFFRES, sujetDuMoment } from "@/briques/note-extraits/sujets";

describe("X4-02 sujets des extraits", () => {
  it("la liste officielle n'est pas modifiée (12 types)", () => {
    expect(TYPES_AUTOMATISATION).toHaveLength(12);
    expect(TYPES_AUTOMATISATION.map((t) => t.id)).toEqual([
      "devis-factures", "relances-impayes", "emails-messages", "comptes-rendus",
      "rendez-vous-planning", "recrutement", "suivi-commercial", "documents-signatures",
      "publication-contenu", "donnees-ia-sure", "former-equipes", "trouver-quoi-automatiser",
    ]);
    expect(TYPES_AUTOMATISATION.map((t) => t.id)).not.toContain("appels-offres");
  });

  it("le type de la vidéo gagne toujours", () => {
    expect(sujetDuMoment({ video: { typeAutomatisation: "recrutement" }, script: { typeAutomatisation: "devis-factures" }, texte: "répondre aux appels d'offres publics" })).toBe("recrutement");
  });

  it("le type du script passe avant le texte", () => {
    expect(sujetDuMoment({ script: { typeAutomatisation: "devis-factures" }, texte: "CRM" })).toBe("devis-factures");
  });

  it("le cas concret passe avant le texte", () => {
    const cas = { id: "devis-relances", titre: "", promesse: "" };
    expect(sujetDuMoment({ cas, texte: "CRM" })).toBe("relances-impayes");
  });

  it("deux sujets possibles sans type : null (règle officielle)", () => {
    expect(sujetDuMoment({ texte: "relance de devis impayé" })).toBeNull();
  });

  it("appels d'offres reconnus", () => {
    expect(sujetDuMoment({ texte: "répondre aux appels d'offres publics" })).toBe("appels-offres");
    expect(sujetDuMoment({ texte: "Marché public : dépôt sur le BOAMP" })).toBe("appels-offres");
    expect(MOTIF_APPELS_OFFRES.test("soumissionner")).toBe(true);
  });

  it("déduction par mots", () => {
    expect(sujetDuMoment({ texte: "CRM" })).toBe("suivi-commercial");
    expect(sujetDuMoment({ texte: "publier sur LinkedIn" })).toBe("publication-contenu");
    expect(sujetDuMoment({ texte: "bonjour" })).toBeNull();
  });

  it("libellés officiels et « Appels d'offres »", () => {
    for (const t of TYPES_AUTOMATISATION) expect(LIBELLE_SUJET_EXTRAIT[t.id]).toBe(t.libelle);
    expect(LIBELLE_SUJET_EXTRAIT["appels-offres"]).toBe("Appels d'offres");
  });
});
