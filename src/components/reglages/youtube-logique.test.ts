import { describe, expect, it } from "vitest";
import { PROPOSITION_YOUTUBE, type ReglagesYoutube } from "@/fournisseurs/publication/zernio-youtube";
import { appliquerSuggestions, detailInterrupteur, reglagesModifies, resumeCarteYoutube, TEXTES_LOGIQUE_YOUTUBE } from "./youtube-logique";

const enregistres: ReglagesYoutube = { visibilite: "private", categorieId: "28", synthetique: "non", pourEnfants: false, titre: "premiere-ligne" };

describe("résumé de la carte YouTube Shorts", () => {
  it("éteint : rien ne part", () => {
    expect(resumeCarteYoutube(false)).toBe("Éteint : rien ne part vers YouTube tant que vous ne l'allumez pas");
  });
  it("allumé : les Shorts partent avec les réglages enregistrés", () => {
    expect(resumeCarteYoutube(true)).toBe("Allumé : les Shorts partent vers YouTube avec les réglages enregistrés");
  });
});

describe("« Remplir avec les suggestions »", () => {
  it("ne touche pas la visibilité courante", () => {
    const r = appliquerSuggestions({ visibilite: "private", categorieId: "" });
    expect(r.visibilite).toBe("private");
    expect(r.categorieId).toBe(PROPOSITION_YOUTUBE.categorieId);
    expect(r.titre).toBe(PROPOSITION_YOUTUBE.titre);
  });
  it("visibilité non choisie : reste non choisie (jamais Public d'office)", () => {
    expect(appliquerSuggestions({ categorieId: "" }).visibilite).toBeUndefined();
  });
  it("ne passe jamais Public tout seul", () => {
    expect(appliquerSuggestions({ visibilite: "unlisted", categorieId: "" }).visibilite).toBe("unlisted");
  });
});

describe("formulaire modifié ou non", () => {
  it("identique aux réglages enregistrés : pas modifié", () => {
    expect(reglagesModifies({ ...enregistres }, enregistres)).toBe(false);
  });
  it("un champ change : modifié", () => {
    expect(reglagesModifies({ ...enregistres, visibilite: "public" }, enregistres)).toBe(true);
  });
  it("rien d'enregistré et formulaire vide : pas modifié ; rempli : modifié", () => {
    expect(reglagesModifies({ categorieId: "" }, null)).toBe(false);
    expect(reglagesModifies({ categorieId: "27" }, null)).toBe(true);
  });
  it("cas du point 2 : modifié et éteint = allumage grisé ; allumé = pas grisé", () => {
    const m = reglagesModifies({ ...enregistres, visibilite: "public" }, enregistres);
    expect(m && !false).toBe(true);
    expect(TEXTES_LOGIQUE_YOUTUBE.nonEnregistre).toBe("Vos changements ne sont pas encore enregistrés : l'envoi utilise les réglages précédents.");
  });
});

describe("détail de l'interrupteur", () => {
  it("dit la visibilité réellement enregistrée", () => {
    expect(detailInterrupteur(enregistres)).toContain("Allumé : les Shorts partent en Privé");
    expect(detailInterrupteur({ ...enregistres, visibilite: "public" })).toContain("Allumé : les Shorts partent en Public");
  });
  it("sans réglages : demande d'enregistrer d'abord", () => {
    expect(detailInterrupteur(null)).toContain("Enregistrez d'abord");
  });
});
